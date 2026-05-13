import { prisma } from './prisma';
import { redis } from './redis';
import { Prisma } from '@/generated/prisma/client';
import type { ReservationInfo } from './validators';
import { v4 as uuidv4 } from 'uuid';

const RESERVATION_TTL_MINUTES = 10;
const LOCK_TTL_SECONDS = 10;

// Custom error classes
export class ConflictError extends Error {
  constructor(message = 'Not enough stock available') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class GoneError extends Error {
  constructor(message = 'Reservation has expired') {
    super(message);
    this.name = 'GoneError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Reservation not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// --- Distributed Lock using Redis ---
async function acquireLock(key: string, ttlSeconds = LOCK_TTL_SECONDS): Promise<string | null> {
  const token = uuidv4();
  try {
    const result = await redis.set(`lock:${key}`, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  } catch {
    // If Redis is down, proceed without lock (DB transaction is the safety net)
    console.warn('Redis lock acquisition failed, falling back to DB-only concurrency');
    return token;
  }
}

async function releaseLock(key: string, token: string): Promise<void> {
  try {
    // Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, `lock:${key}`, token);
  } catch {
    console.warn('Redis lock release failed');
  }
}

// --- Idempotency (Bonus) ---
async function checkIdempotency(key: string): Promise<string | null> {
  try {
    const cached = await redis.get(`idempotency:${key}`);
    return cached;
  } catch {
    return null;
  }
}

async function storeIdempotency(key: string, response: string): Promise<void> {
  try {
    await redis.set(`idempotency:${key}`, response, 'EX', 86400); // 24h TTL
  } catch {
    console.warn('Failed to store idempotency key');
  }
}

// --- Core Business Logic ---

/**
 * Reserve stock for a product at a specific warehouse.
 * Uses PostgreSQL transaction with row-level locking (SELECT FOR UPDATE)
 * plus optional Redis distributed lock for additional safety.
 */
export async function reserveStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  idempotencyKey?: string | null
): Promise<ReservationInfo> {
  // Check idempotency
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey);
    if (cached) {
      return JSON.parse(cached) as ReservationInfo;
    }
  }

  const lockKey = `stock:${productId}:${warehouseId}`;
  const lockToken = await acquireLock(lockKey);
  
  if (!lockToken) {
    throw new ConflictError('System is busy processing another request for this item. Please retry.');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find and lock the stock row using raw SQL FOR UPDATE
      const stocks = await tx.$queryRaw<Array<{
        id: string;
        productId: string;
        warehouseId: string;
        totalUnits: number;
        reservedUnits: number;
      }>>`
        SELECT "id", "productId", "warehouseId", "totalUnits", "reservedUnits"
        FROM "Stock"
        WHERE "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (stocks.length === 0) {
        throw new NotFoundError('Stock entry not found for this product/warehouse combination');
      }

      const stock = stocks[0];
      const available = stock.totalUnits - stock.reservedUnits;

      // 2. Check availability
      if (available < quantity) {
        throw new ConflictError(
          `Not enough stock available. Requested: ${quantity}, Available: ${available}`
        );
      }

      // 3. Increment reservedUnits atomically
      await tx.stock.update({
        where: { id: stock.id },
        data: { reservedUnits: { increment: quantity } },
      });

      // 4. Create reservation with expiry
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      const reservation = await tx.reservation.create({
        data: {
          stockId: stock.id,
          quantity,
          expiresAt,
          idempotencyKey: idempotencyKey || null,
        },
        include: {
          stock: {
            include: {
              product: true,
              warehouse: true,
            },
          },
        },
      });

      return reservation;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    });

    const response = formatReservation(result);

    // Store idempotency result
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, JSON.stringify(response));
    }

    return response;
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

/**
 * Confirm a reservation (payment succeeded).
 * Permanently decrements stock and marks reservation as CONFIRMED.
 */
export async function confirmReservation(
  reservationId: string,
  idempotencyKey?: string | null
): Promise<ReservationInfo> {
  // Check idempotency
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey);
    if (cached) {
      return JSON.parse(cached) as ReservationInfo;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the reservation row
    const reservations = await tx.$queryRaw<Array<{
      id: string;
      stockId: string;
      quantity: number;
      status: string;
      expiresAt: Date;
    }>>`
      SELECT "id", "stockId", "quantity", "status", "expiresAt"
      FROM "Reservation"
      WHERE "id" = ${reservationId}
      FOR UPDATE
    `;

    if (reservations.length === 0) {
      throw new NotFoundError('Reservation not found');
    }

    const reservation = reservations[0];

    if (reservation.status !== 'PENDING') {
      throw new ConflictError(`Reservation is already ${reservation.status.toLowerCase()}`);
    }

    // Check if expired
    if (new Date(reservation.expiresAt) < new Date()) {
      // Auto-release the expired reservation
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: { reservedUnits: { decrement: reservation.quantity } },
      });
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'EXPIRED' },
      });
      throw new GoneError('Reservation has expired. Stock has been released.');
    }

    // Confirm: release from reserved pool AND permanently decrement total
    await tx.stock.update({
      where: { id: reservation.stockId },
      data: {
        reservedUnits: { decrement: reservation.quantity },
        totalUnits: { decrement: reservation.quantity },
      },
    });

    return tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CONFIRMED' },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
    });
  }, {
    timeout: 10000,
  });

  const response = formatReservation(result);

  if (idempotencyKey) {
    await storeIdempotency(idempotencyKey, JSON.stringify(response));
  }

  return response;
}

/**
 * Release a reservation early (payment failed or user cancelled).
 */
export async function releaseReservation(reservationId: string): Promise<ReservationInfo> {
  const result = await prisma.$transaction(async (tx) => {
    const reservations = await tx.$queryRaw<Array<{
      id: string;
      stockId: string;
      quantity: number;
      status: string;
    }>>`
      SELECT "id", "stockId", "quantity", "status"
      FROM "Reservation"
      WHERE "id" = ${reservationId}
      FOR UPDATE
    `;

    if (reservations.length === 0) {
      throw new NotFoundError('Reservation not found');
    }

    const reservation = reservations[0];

    if (reservation.status !== 'PENDING') {
      throw new ConflictError(`Reservation is already ${reservation.status.toLowerCase()}`);
    }

    // Release: decrement reservedUnits (units return to available pool)
    await tx.stock.update({
      where: { id: reservation.stockId },
      data: { reservedUnits: { decrement: reservation.quantity } },
    });

    return tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED' },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
    });
  }, {
    timeout: 10000,
  });

  return formatReservation(result);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatReservation(reservation: any): ReservationInfo {
  return {
    id: reservation.id,
    stockId: reservation.stockId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
    product: {
      id: reservation.stock.product.id,
      name: reservation.stock.product.name,
      sku: reservation.stock.product.sku,
      price: reservation.stock.product.price,
      imageUrl: reservation.stock.product.imageUrl,
      category: reservation.stock.product.category,
    },
    warehouse: {
      id: reservation.stock.warehouse.id,
      name: reservation.stock.warehouse.name,
      location: reservation.stock.warehouse.location,
    },
  };
}
