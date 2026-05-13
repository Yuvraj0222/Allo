import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log('  ✓ Cleared existing data\n');

  // Create warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: 'Mumbai Central',
        location: 'Mumbai, Maharashtra',
        code: 'WH-MUM',
      },
    }),
    prisma.warehouse.create({
      data: {
        name: 'Delhi NCR Hub',
        location: 'Gurugram, Haryana',
        code: 'WH-DEL',
      },
    }),
    prisma.warehouse.create({
      data: {
        name: 'Bangalore Tech Park',
        location: 'Bangalore, Karnataka',
        code: 'WH-BLR',
      },
    }),
  ]);

  console.log(`  ✓ Created ${warehouses.length} warehouses`);

  // Create products across different domains
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'MacBook Pro 16" M3 Max',
        description: 'Apple MacBook Pro with M3 Max chip, 36GB RAM, 1TB SSD. Space Black.',
        sku: 'ELEC-MBP16-M3',
        price: 349900,
        category: 'Electronics',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Sony WH-1000XM5',
        description: 'Premium noise-cancelling wireless headphones with 30-hour battery.',
        sku: 'ELEC-SONY-XM5',
        price: 29990,
        category: 'Electronics',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Nike Air Jordan 1 Retro High',
        description: 'Iconic basketball sneakers in Chicago colorway. Limited edition.',
        sku: 'FASH-AJ1-CHI',
        price: 16995,
        category: 'Fashion',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Dyson V15 Detect',
        description: 'Cordless vacuum with laser dust detection and LCD screen.',
        sku: 'HOME-DYS-V15',
        price: 62900,
        category: 'Home',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Yonex Astrox 99 Pro',
        description: 'Professional badminton racket used by world champions. 4U weight.',
        sku: 'SPRT-YNX-A99',
        price: 18500,
        category: 'Sports',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Penguin Classics Box Set',
        description: 'Collection of 10 timeless literary classics in hardcover.',
        sku: 'BOOK-PGN-CLX',
        price: 4999,
        category: 'Books',
      },
    }),
    prisma.product.create({
      data: {
        name: 'La Mer Crème de la Mer',
        description: 'Luxury moisturizing cream, 60ml. Miracle Broth formula.',
        sku: 'BEAU-LMR-CRM',
        price: 33500,
        category: 'Beauty',
      },
    }),
    prisma.product.create({
      data: {
        name: 'LEGO Technic Lamborghini',
        description: 'Lamborghini Sián FKP 37 set. 3,696 pieces for adults.',
        sku: 'TOYS-LGO-LAM',
        price: 34999,
        category: 'Toys',
      },
    }),
  ]);

  console.log(`  ✓ Created ${products.length} products`);

  // Create stock entries with varying quantities
  const stockData = [
    // MacBook - limited stock
    { product: products[0], warehouse: warehouses[0], total: 5 },
    { product: products[0], warehouse: warehouses[1], total: 3 },
    { product: products[0], warehouse: warehouses[2], total: 8 },
    // Sony headphones - good stock
    { product: products[1], warehouse: warehouses[0], total: 50 },
    { product: products[1], warehouse: warehouses[1], total: 35 },
    { product: products[1], warehouse: warehouses[2], total: 40 },
    // Jordan 1 - very limited
    { product: products[2], warehouse: warehouses[0], total: 3 },
    { product: products[2], warehouse: warehouses[1], total: 2 },
    { product: products[2], warehouse: warehouses[2], total: 1 },
    // Dyson vacuum
    { product: products[3], warehouse: warehouses[0], total: 15 },
    { product: products[3], warehouse: warehouses[1], total: 20 },
    { product: products[3], warehouse: warehouses[2], total: 12 },
    // Yonex racket
    { product: products[4], warehouse: warehouses[0], total: 10 },
    { product: products[4], warehouse: warehouses[1], total: 8 },
    { product: products[4], warehouse: warehouses[2], total: 15 },
    // Books
    { product: products[5], warehouse: warehouses[0], total: 100 },
    { product: products[5], warehouse: warehouses[1], total: 75 },
    { product: products[5], warehouse: warehouses[2], total: 60 },
    // La Mer - limited luxury
    { product: products[6], warehouse: warehouses[0], total: 4 },
    { product: products[6], warehouse: warehouses[1], total: 6 },
    { product: products[6], warehouse: warehouses[2], total: 3 },
    // LEGO
    { product: products[7], warehouse: warehouses[0], total: 20 },
    { product: products[7], warehouse: warehouses[1], total: 15 },
    { product: products[7], warehouse: warehouses[2], total: 25 },
  ];

  const stocks = await Promise.all(
    stockData.map((s) =>
      prisma.stock.create({
        data: {
          productId: s.product.id,
          warehouseId: s.warehouse.id,
          totalUnits: s.total,
          reservedUnits: 0,
        },
      })
    )
  );

  console.log(`  ✓ Created ${stocks.length} stock entries\n`);

  // Summary
  console.log('📊 Seed Summary:');
  console.log(`   Warehouses: ${warehouses.length}`);
  console.log(`   Products:   ${products.length}`);
  console.log(`   Stock:      ${stocks.length} entries`);
  console.log(`   Total units: ${stockData.reduce((sum, s) => sum + s.total, 0)}`);
  console.log('\n✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
