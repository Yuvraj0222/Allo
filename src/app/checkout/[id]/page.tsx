import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import CheckoutClient from '@/components/CheckoutClient';
import { ToastProvider } from '@/components/ToastProvider';
import type { ReservationInfo } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      stock: {
        include: {
          product: true,
          warehouse: true,
        },
      },
    },
  });

  if (!reservation) {
    notFound();
  }

  const formatted: ReservationInfo = {
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

  return (
    <ToastProvider>
      <CheckoutClient reservation={formatted} />
    </ToastProvider>
  );
}
