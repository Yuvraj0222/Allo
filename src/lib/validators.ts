import { z } from 'zod';

// Schema for creating a reservation
export const ReserveRequestSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(100, 'Quantity cannot exceed 100'),
});

export type ReserveRequest = z.infer<typeof ReserveRequestSchema>;

// Response types
export interface ProductWithStock {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  imageUrl: string | null;
  category: string;
  stocks: StockInfo[];
}

export interface StockInfo {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

export interface WarehouseInfo {
  id: string;
  name: string;
  location: string;
  code: string;
}

export interface ReservationInfo {
  id: string;
  stockId: string;
  quantity: number;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    imageUrl: string | null;
    category: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
