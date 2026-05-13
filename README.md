# Allo — Inventory Reservation System

A real-time inventory reservation platform for multi-warehouse retail and D2C brands, built with Next.js, Prisma, PostgreSQL, and Redis.

> **Live URL:** _[To be added after deployment]_

## Problem

When a customer proceeds to checkout, payment can take several minutes (3DS flows, UPI confirmations, wallet redirects). During that window, other shoppers see the same inventory. Without a reservation system:

- **Decrement at payment time** → two customers pay for the same unit → refunds, bad UX, ops cleanup
- **Decrement at cart time** → abandoned carts deplete visible inventory → conversion tanks

**The solution:** temporarily hold (reserve) units during checkout. Confirm on payment success, auto-release on timeout or cancellation.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Next.js App   │────▶│  API Routes  │────▶│  Supabase        │
│   (Frontend)    │     │  (Backend)   │     │  (PostgreSQL)    │
└─────────────────┘     └──────┬───────┘     └──────────────────┘
                               │
                        ┌──────▼───────┐
                        │  Redis Cloud │
                        │  (Locks +    │
                        │  Idempotency)│
                        └──────────────┘
```

### Concurrency Strategy (Core of the Exercise)

The reservation system uses a **dual-layer locking approach** to guarantee correctness:

1. **PostgreSQL `SELECT ... FOR UPDATE`** (primary safety net): Within a `Serializable` isolation transaction, the stock row is locked before reading. If two requests arrive for the last unit simultaneously:
   - Request A acquires the row lock → reads `available = 1` → succeeds
   - Request B **waits** for the lock → reads `available = 0` → gets 409
   - The database guarantees serialized access — no race condition possible

2. **Redis Distributed Lock** (performance layer): Before entering the DB transaction, we acquire a Redis lock keyed on `stock:{productId}:{warehouseId}`. This prevents thundering-herd scenarios in serverless (many Lambda/Edge instances hitting the same row). If Redis is unavailable, the system falls back to DB-only concurrency.

### Why not optimistic locking alone?

Optimistic locking (version field + retry) works well for **low-contention** scenarios. But inventory reservation during flash sales has **high contention** — many users compete for the last few units. Pessimistic locking with `FOR UPDATE` avoids wasted retries and provides a cleaner guarantee.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL (Supabase) |
| Cache/Locks | Redis Cloud (ioredis) |
| Validation | Zod |
| Styling | Tailwind CSS 4 + custom CSS |
| Deployment | Vercel |

## API Endpoints

| Method | Path | Behaviour |
|--------|------|-----------|
| `GET` | `/api/products` | List products with available stock per warehouse |
| `GET` | `/api/warehouses` | List warehouses |
| `POST` | `/api/reservations` | Reserve units. Returns `409` if insufficient stock |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation. Returns `410` if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation early |
| `GET` | `/api/cron/expire-reservations` | Cron endpoint to expire stale reservations |

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (Supabase, Neon, or Railway free tier)
- A Redis instance (Redis Cloud, Upstash, etc.)

### 1. Clone & Install

```bash
git clone <repo-url>
cd allo
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
# Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxxx:password@aws-0-region.supabase.com:5432/postgres"

# Redis
REDIS_URL="redis://default:password@your-redis-host:port"

# Cron secret (any random string)
CRON_SECRET="your-secret-here"
```

### 3. Run Migrations & Seed

```bash
npx prisma generate
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Reservation Expiry

Three-pronged approach for reliability:

### 1. Vercel Cron Job (Primary)
Configured in `vercel.json` to run every minute. Queries all `PENDING` reservations where `expiresAt < NOW()`, decrements `reservedUnits`, and sets status to `EXPIRED`.

### 2. Lazy Cleanup on Read
When `GET /api/products` is called, it first runs the expiry cleanup before returning results. This ensures stock counts are always accurate when users browse.

### 3. Check on Confirm
When confirming a reservation, the API checks if `expiresAt < NOW()`. If expired, it auto-releases the stock and returns `410 Gone`.

### Why this approach?

| Approach | Pros | Cons |
|----------|------|------|
| Cron Job | Reliable, periodic cleanup | Up to 1 min delay |
| Lazy on Read | Always-accurate stock display | Slight latency on first load |
| Check on Confirm | Guarantees no expired confirmations | Only runs on confirm attempts |

The combination of all three provides eventual consistency (cron), display accuracy (lazy), and hard correctness (confirm check).

## Idempotency (Bonus)

### How it works

1. Client sends `Idempotency-Key: <uuid>` header with POST requests
2. Server checks Redis for `idempotency:<key>`
3. If found → returns cached response without repeating side effects
4. If not found → processes request, caches response with 24h TTL
5. Database also has `UNIQUE` constraint on `idempotencyKey` column as safety net

### Why Redis + DB?

- **Redis** provides fast lookup and automatic TTL expiry
- **DB unique constraint** prevents duplicate reservations even if Redis fails
- **Defense in depth** — the system is correct even if one layer is unavailable

## Data Model

```
Product ──┐
           ├── Stock (productId + warehouseId, unique)
Warehouse ─┘      │
                   └── Reservation (stockId, quantity, status, expiresAt)
```

- `Stock.totalUnits` — total physical units at warehouse
- `Stock.reservedUnits` — currently held by pending reservations
- **Available** = `totalUnits - reservedUnits`
- On **confirm**: both `totalUnits` and `reservedUnits` decrement (units leave the system)
- On **release/expire**: only `reservedUnits` decrements (units return to available pool)

## Trade-offs & What I'd Do Differently

### Current Trade-offs

1. **No auth/user sessions** — Reservations aren't tied to user accounts. In production, you'd want to prevent one user from hoarding all stock.

2. **Single-product reservations** — Each reservation is for one product at one warehouse. A real checkout would group items into an order.

3. **No WebSocket/SSE for real-time stock updates** — Stock counts refresh on page load, not in real-time. Adding Server-Sent Events would show live stock changes.

4. **Cron granularity** — Vercel free tier crons run every minute. Some reservations may show as "pending" for up to 60 seconds after expiry. The lazy cleanup and confirm-time check mitigate this.

### With More Time

- **WebSocket stock updates** — Push stock changes to connected clients
- **Multi-item cart reservations** — Reserve multiple products in a single transaction
- **Rate limiting** — Prevent abuse of the reservation endpoint
- **Comprehensive test suite** — Integration tests for concurrent reservation scenarios
- **Monitoring & alerting** — Track reservation rates, expiry rates, and conflict rates
- **Admin dashboard** — View reservation status, stock levels, and manual overrides

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── products/route.ts          # GET /api/products
│   │   ├── warehouses/route.ts        # GET /api/warehouses
│   │   ├── reservations/
│   │   │   ├── route.ts               # POST /api/reservations
│   │   │   └── [id]/
│   │   │       ├── confirm/route.ts   # POST /api/reservations/:id/confirm
│   │   │       └── release/route.ts   # POST /api/reservations/:id/release
│   │   └── cron/
│   │       └── expire-reservations/route.ts
│   ├── checkout/[id]/page.tsx         # Checkout page
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Product listing
│   └── globals.css                     # Design system
├── components/
│   ├── CheckoutClient.tsx             # Checkout with countdown
│   ├── ProductCard.tsx                # Product card with reserve dialog
│   └── ToastProvider.tsx              # Toast notifications
├── lib/
│   ├── prisma.ts                      # Prisma client singleton
│   ├── redis.ts                       # Redis client
│   ├── reservation-service.ts         # Core business logic
│   ├── expiry.ts                      # Expiry cleanup
│   └── validators.ts                  # Zod schemas + types
└── generated/prisma/                  # Prisma generated client
prisma/
├── schema.prisma                      # Data model
├── seed.ts                            # Seed script
└── migrations/                        # Migration history
```

## License

MIT
