import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expireStaleReservations } from '@/lib/expiry';
import type { ProductWithStock } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Lazy cleanup: expire stale reservations before listing
    await expireStaleReservations();

    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted: ProductWithStock[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      stocks: product.stocks.map((stock) => ({
        id: stock.id,
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name,
        warehouseLocation: stock.warehouse.location,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
        availableUnits: stock.totalUnits - stock.reservedUnits,
      })),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch products', statusCode: 500 },
      { status: 500 }
    );
  }
}
