# Inventory Reservation System

Full-stack inventory reservation system for multi-warehouse e-commerce checkout holds. It uses Next.js App Router, TypeScript, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui-style components, and Zod validation.

The critical correctness goal is enforced in the database: if two requests try to reserve the last unit at the same time, exactly one conditional `UPDATE` can increment `reservedStock`; the loser receives HTTP `409`.

## Features

- Product inventory listing grouped by warehouse.
- Temporary checkout reservations that expire after 10 minutes.
- Confirm flow decrements both `reservedStock` and `totalStock`.
- Release flow decrements `reservedStock` and marks the reservation released.
- Lazy cleanup of expired pending reservations before reads and writes.
- Zod request validation shared by API and client-adjacent code.
- Optional `Idempotency-Key` support for reservation creation.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env`:

   ```bash
   cp .env.example .env
   ```

3. Set `DATABASE_URL` to a PostgreSQL-compatible database. For local Docker PostgreSQL, a typical value is:

   ```env
   DATABASE_URL = your_neon_url
   DIRECT_URL = your_neon_url
   ```

4. Generate Prisma client and run migrations:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. Seed sample data:

   ```bash
   npm run db:seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## Environment Variables

- `DATABASE_URL`: Runtime PostgreSQL URL. Supabase and Neon pooled URLs are supported.
- `DIRECT_URL`: Direct PostgreSQL URL used by Prisma migrations. This is especially useful for Supabase transaction poolers.

## Prisma Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
```

Use `db:migrate` locally. Use `db:deploy` during production deployment.

## API Routes

- `GET /api/products`: returns products with `totalStock`, `reservedStock`, and computed `availableStock` per warehouse.
- `GET /api/warehouses`: returns all warehouses.
- `POST /api/reservations`: creates a 10-minute reservation from `{ productId, warehouseId, quantity }`.
- `GET /api/reservations/[id]`: returns one reservation for the checkout page.
- `POST /api/reservations/[id]/confirm`: confirms a valid reservation or returns HTTP `410` if expired.
- `POST /api/reservations/[id]/release`: releases a pending reservation.

## Concurrency Strategy

Reservation creation runs inside a Prisma transaction and uses one PostgreSQL conditional update:

```sql
UPDATE "Inventory"
SET "reservedStock" = "reservedStock" + quantity
WHERE "productId" = productId
  AND "warehouseId" = warehouseId
  AND ("totalStock" - "reservedStock") >= quantity
```

This avoids the unsafe pattern of reading available stock in application code and then updating later. PostgreSQL locks the matching row during the update. When two transactions compete for the final unit, only the first update can satisfy the predicate. After it commits, the second update rechecks the row and affects zero rows, so the API returns HTTP `409`.

## Expiry Mechanism

Reservations expire after 10 minutes. The app uses lazy cleanup before reads and writes:

1. Find pending reservations with `expiresAt <= NOW()`.
2. Mark them `RELEASED`.
3. Group their quantities by product and warehouse.
4. Decrement matching inventory `reservedStock`.

This keeps runtime behavior correct without requiring a background worker. A production system can add a scheduled cleanup job for faster housekeeping, but it should keep the lazy cleanup as a correctness backstop.

## Deployment: Vercel + Supabase or Neon

1. Create a Supabase or Neon PostgreSQL database.
2. Add `DATABASE_URL` and `DIRECT_URL` to Vercel project environment variables.
3. Run migrations from CI or your machine:

   ```bash
   npm run db:deploy
   ```

4. Optional: seed non-production environments:

   ```bash
   npm run db:seed
   ```

5. Deploy to Vercel:

   ```bash
   vercel
   ```

The `build` script runs `prisma generate` before `next build`.

## Trade-offs and Future Improvements

- Lazy expiry is simple and correct, but a scheduled worker would reduce stale rows faster.
- Idempotency is implemented for successful reservation creation; a production-grade version could store in-progress states with retry-after semantics.
- Confirm and release are idempotent for already-confirmed or already-released reservations.
- For very high contention, consider shorter transactions, stricter observability around `409` rates, and database-side stored procedures for critical inventory mutations.
