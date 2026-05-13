import { NextRequest, NextResponse } from 'next/server';
import {
  confirmReservation,
  ConflictError,
  GoneError,
  NotFoundError,
} from '@/lib/reservation-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idempotencyKey = request.headers.get('idempotency-key');

    const reservation = await confirmReservation(id, idempotencyKey);

    return NextResponse.json(reservation);
  } catch (error) {
    if (error instanceof GoneError) {
      return NextResponse.json(
        { error: 'Gone', message: error.message, statusCode: 410 },
        { status: 410 }
      );
    }
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
    console.error('Error confirming reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to confirm reservation', statusCode: 500 },
      { status: 500 }
    );
  }
}
