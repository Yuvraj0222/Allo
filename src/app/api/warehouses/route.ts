import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { WarehouseInfo } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });

    const formatted: WarehouseInfo[] = warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      location: w.location,
      code: w.code,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch warehouses', statusCode: 500 },
      { status: 500 }
    );
  }
}
