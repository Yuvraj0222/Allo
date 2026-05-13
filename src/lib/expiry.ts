import { prisma } from './prisma';

/**
 * Expire all pending reservations that have passed their expiresAt time.
 * This function:
 * 1. Finds all PENDING reservations where expiresAt < NOW()
 * 2. Decrements reservedUnits on the stock row for each
 * 3. Sets status to EXPIRED
 * 
 * Used by:
 * - Vercel Cron job (runs every minute)
 * - Lazy cleanup on product listing reads
 */
export async function expireStaleReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      stockId: true,
      quantity: true,
    },
  });

  if (expiredReservations.length === 0) {
    return 0;
  }

  // Process each expired reservation in a transaction
  let expiredCount = 0;

  for (const reservation of expiredReservations) {
    try {
      await prisma.$transaction(async (tx) => {
        // Double-check the reservation is still PENDING (another process might have handled it)
        const current = await tx.reservation.findUnique({
          where: { id: reservation.id },
          select: { status: true },
        });

        if (current?.status !== 'PENDING') {
          return; // Already handled
        }

        // Release the reserved units
        await tx.stock.update({
          where: { id: reservation.stockId },
          data: { reservedUnits: { decrement: reservation.quantity } },
        });

        // Mark as expired
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: 'EXPIRED' },
        });
      });

      expiredCount++;
    } catch (error) {
      console.error(`Failed to expire reservation ${reservation.id}:`, error);
    }
  }

  if (expiredCount > 0) {
    console.log(`Expired ${expiredCount} stale reservations`);
  }

  return expiredCount;
}
