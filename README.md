## 🌐 Live Demo

https://inventory-reservation-system-topaz.vercel.app/

> Note: The app is hosted on Vercel’s free tier. The first request may take a few seconds due to cold start.

---

# Inventory Reservation System

Full-stack inventory reservation system for multi-warehouse e-commerce checkout holds. Built using Next.js App Router, TypeScript, Prisma, PostgreSQL, Tailwind CSS, and Zod.

The critical correctness goal is enforced in the database: if two requests try to reserve the last unit at the same time, exactly one conditional `UPDATE` can increment `reservedStock`; the other receives HTTP `409`.

---

## Features

* Product inventory listing grouped by warehouse.
* Available stock calculated as:

  ```
  availableStock = totalStock - reservedStock
  ```
* Temporary checkout reservations that expire after 10 minutes.
* Confirm flow decrements both `reservedStock` and `totalStock`.
* Release flow decrements `reservedStock` and marks the reservation released.
* Lazy cleanup of expired pending reservations before reads and writes.
* UI updates automatically after confirm/cancel (no manual refresh required).
* Proper error handling:

  * HTTP `409` → insufficient stock
  * HTTP `410` → reservation expired
* Zod validation for API requests.
* Optional `Idempotency-Key` support.

---

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env`:

   ```bash
   cp .env.example .env
   ```

3. Add your PostgreSQL connection string:

   ```env
   DATABASE_URL="your_postgresql_connection_string"
   DIRECT_URL="your_postgresql_connection_string"
   ```

4. Run migrations:

   ```bash
   npm run db:migrate
   ```

5. Seed the database:

   ```bash
   npm run db:seed
   ```

   This will create sample:

   * Products
   * Warehouses
   * Inventory

6. Start the app:

   ```bash
   npm run dev
   ```

Open:

```
http://localhost:3000
```

---

## Environment Variables

* `DATABASE_URL`: PostgreSQL connection string (Neon/Supabase supported)
* `DIRECT_URL`: Direct connection string for Prisma migrations

---

## API Routes

* `GET /api/products`
  Returns products with `totalStock`, `reservedStock`, and `availableStock`.

* `GET /api/warehouses`
  Returns all warehouses.

* `POST /api/reservations`
  Creates reservation. Returns `409` if insufficient stock.

* `GET /api/reservations/[id]`
  Returns reservation details.

* `POST /api/reservations/[id]/confirm`
  Confirms reservation. Returns `410` if expired.

* `POST /api/reservations/[id]/release`
  Releases reservation early.

---

## Concurrency Strategy

Reservation creation is handled using a Prisma transaction with a PostgreSQL conditional update:

```sql
UPDATE "Inventory"
SET "reservedStock" = "reservedStock" + quantity
WHERE "productId" = productId
  AND "warehouseId" = warehouseId
  AND ("totalStock" - "reservedStock") >= quantity
```

This avoids race conditions caused by checking stock in application code.

PostgreSQL ensures row-level locking during the update:

* If two requests compete for the last unit:

  * First request succeeds
  * Second request affects 0 rows → returns HTTP `409`

This guarantees no overselling.

---

## Reservation Expiry

Reservations expire after 10 minutes.

Lazy cleanup is used:

1. Find expired pending reservations
2. Mark them as `RELEASED`
3. Aggregate quantities
4. Decrement `reservedStock`

This ensures correctness without a background worker.

A production system could add a cron job, but lazy cleanup ensures safety.

---

## Deployment

Deployed using:

* Vercel (application)
* Neon / Supabase (PostgreSQL)

### Steps

1. Create database
2. Add environment variables in Vercel:

   ```
   DATABASE_URL
   DIRECT_URL
   ```
3. Run:

   ```bash
   npm run db:deploy
   ```
4. (Optional) Seed:

   ```bash
   npm run db:seed
   ```

---

## Trade-offs & Improvements

* Lazy cleanup is simple but a scheduled worker would reduce stale data faster.
* Idempotency is partially implemented; can be extended for retries.
* UI is intentionally minimal to focus on correctness.
* For high contention, database-level procedures or Redis locking could be added.

---

## Summary

This system ensures:

* Correct inventory handling under concurrency
* No overselling
* Clean reservation lifecycle
* Simple but production-minded architecture
