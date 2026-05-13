import { NextRequest, NextResponse } from 'next/server';
import {
  releaseReservation,
  ConflictError,
  NotFoundError,
} from '@/lib/reservation-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await releaseReservation(id);

    return NextResponse.json(reservation);
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
    console.error('Error releasing reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to release reservation', statusCode: 500 },
      { status: 500 }
    );
  }
}
