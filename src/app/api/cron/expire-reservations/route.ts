import { NextRequest, NextResponse } from 'next/server';
import { expireStaleReservations } from '@/lib/expiry';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to expire stale reservations.
 * Called by Vercel Cron every minute.
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid cron secret' },
      { status: 401 }
    );
  }

  try {
    const expiredCount = await expireStaleReservations();
    return NextResponse.json({
      success: true,
      expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron: Error expiring reservations:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to expire reservations' },
      { status: 500 }
    );
  }
}
