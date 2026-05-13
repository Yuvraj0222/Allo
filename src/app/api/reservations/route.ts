import { NextRequest, NextResponse } from 'next/server';
import { ReserveRequestSchema } from '@/lib/validators';
import {
  reserveStock,
  ConflictError,
  NotFoundError,
} from '@/lib/reservation-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const parsed = ReserveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: parsed.error.issues.map((e) => e.message).join(', '),
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Extract idempotency key from header (bonus feature)
    const idempotencyKey = request.headers.get('idempotency-key');

    const reservation = await reserveStock(
      parsed.data.productId,
      parsed.data.warehouseId,
      parsed.data.quantity,
      idempotencyKey
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(
        { error: 'Conflict', message: error.message, statusCode: 409 },
        { status: 409 }
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: 'Not Found', message: error.message, statusCode: 404 },
        { status: 404 }
      );
    }
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create reservation', statusCode: 500 },
      { status: 500 }
    );
  }
}
