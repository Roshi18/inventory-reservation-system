import crypto from "node:crypto";
import { Prisma, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-errors";
import type { ReservationCreateInput } from "@/lib/schemas";

const RESERVATION_TTL_MINUTES = 10;

type Tx = Prisma.TransactionClient;

export type ReservationDetails = Awaited<ReturnType<typeof getReservation>>;

export function requestHash(input: ReservationCreateInput) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function cleanupExpiredReservations(tx: Tx = prisma) {
  await tx.$executeRaw`
    WITH expired AS (
      UPDATE "Reservation"
      SET "status" = 'RELEASED'::"ReservationStatus", "updatedAt" = NOW()
      WHERE "status" = 'PENDING'::"ReservationStatus"
        AND "expiresAt" <= NOW()
      RETURNING "productId", "warehouseId", "quantity"
    ),
    grouped AS (
      SELECT "productId", "warehouseId", SUM("quantity")::int AS "quantity"
      FROM expired
      GROUP BY "productId", "warehouseId"
    )
    UPDATE "Inventory" AS inventory
    SET "reservedStock" = GREATEST(0, inventory."reservedStock" - grouped."quantity"),
        "updatedAt" = NOW()
    FROM grouped
    WHERE inventory."productId" = grouped."productId"
      AND inventory."warehouseId" = grouped."warehouseId"
  `;
}

export async function listProductsWithInventory() {
  await cleanupExpiredReservations();

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      inventory: {
        orderBy: { warehouse: { name: "asc" } },
        include: { warehouse: true }
      }
    }
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    createdAt: product.createdAt,
    warehouses: product.inventory.map((inventory) => ({
      inventoryId: inventory.id,
      warehouseId: inventory.warehouseId,
      warehouseName: inventory.warehouse.name,
      warehouseLocation: inventory.warehouse.location,
      totalStock: inventory.totalStock,
      reservedStock: inventory.reservedStock,
      availableStock: inventory.totalStock - inventory.reservedStock
    }))
  }));
}

export async function listWarehouses() {
  await cleanupExpiredReservations();
  return prisma.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function getReservation(id: string) {
  await cleanupExpiredReservations();

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: true,
      warehouse: true
    }
  });

  if (!reservation) {
    throw new ApiError(404, "Reservation not found");
  }

  return reservation;
}

export async function createReservation(input: ReservationCreateInput) {
  return prisma.$transaction(async (tx) => {
    await cleanupExpiredReservations(tx);

    const updated = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = "reservedStock" + ${input.quantity},
          "updatedAt" = NOW()
      WHERE "productId" = ${input.productId}
        AND "warehouseId" = ${input.warehouseId}
        AND ("totalStock" - "reservedStock") >= ${input.quantity}
    `;

    if (updated !== 1) {
      throw new ApiError(409, "Insufficient stock for this warehouse");
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    return tx.reservation.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        expiresAt
      },
      include: {
        product: true,
        warehouse: true
      }
    });
  });
}

export async function confirmReservation(id: string) {
  return prisma.$transaction(async (tx) => {
    await cleanupExpiredReservations(tx);

    const now = new Date();
    const reservation = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true }
    });

    if (!reservation) {
      throw new ApiError(404, "Reservation not found");
    }

    if (reservation.status === ReservationStatus.CONFIRMED) {
      return reservation;
    }

    if (reservation.status === ReservationStatus.RELEASED || reservation.expiresAt <= now) {
      throw new ApiError(410, "Reservation has expired or was released");
    }

    const reservationUpdated = await tx.reservation.updateMany({
      where: {
        id,
        status: ReservationStatus.PENDING,
        expiresAt: { gt: now }
      },
      data: { status: ReservationStatus.CONFIRMED }
    });

    if (reservationUpdated.count !== 1) {
      throw new ApiError(410, "Reservation has expired or was already completed");
    }

    const inventoryUpdated = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = "reservedStock" - ${reservation.quantity},
          "totalStock" = "totalStock" - ${reservation.quantity},
          "updatedAt" = NOW()
      WHERE "productId" = ${reservation.productId}
        AND "warehouseId" = ${reservation.warehouseId}
        AND "reservedStock" >= ${reservation.quantity}
        AND "totalStock" >= ${reservation.quantity}
    `;

    if (inventoryUpdated !== 1) {
      throw new ApiError(409, "Inventory changed and this reservation cannot be confirmed");
    }

    return tx.reservation.findUniqueOrThrow({
      where: { id },
      include: { product: true, warehouse: true }
    });
  });
}

export async function releaseReservation(id: string) {
  return prisma.$transaction(async (tx) => {
    await cleanupExpiredReservations(tx);

    const reservation = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true }
    });

    if (!reservation) {
      throw new ApiError(404, "Reservation not found");
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      return reservation;
    }

    const reservationUpdated = await tx.reservation.updateMany({
      where: {
        id,
        status: ReservationStatus.PENDING
      },
      data: { status: ReservationStatus.RELEASED }
    });

    if (reservationUpdated.count !== 1) {
      return tx.reservation.findUniqueOrThrow({
        where: { id },
        include: { product: true, warehouse: true }
      });
    }

    const inventoryUpdated = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = GREATEST(0, "reservedStock" - ${reservation.quantity}),
          "updatedAt" = NOW()
      WHERE "productId" = ${reservation.productId}
        AND "warehouseId" = ${reservation.warehouseId}
    `;

    if (inventoryUpdated !== 1) {
      throw new ApiError(404, "Inventory row not found for reservation");
    }

    return tx.reservation.findUniqueOrThrow({
      where: { id },
      include: { product: true, warehouse: true }
    });
  });
}

export async function getIdempotentReservation(
  key: string,
  hash: string,
  create: () => Promise<unknown>
) {
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        requestHash: hash,
        responseStatus: 202,
        responseBody: { pending: true }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const record = await prisma.idempotencyRecord.findUniqueOrThrow({ where: { key } });
      if (record.requestHash !== hash) {
        throw new ApiError(409, "Idempotency-Key was reused with a different request body");
      }

      return {
        status: record.responseStatus,
        body: record.responseBody
      };
    }

    throw error;
  }

  try {
    const body = await create();
    const jsonBody = JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue;
    await prisma.idempotencyRecord.update({
      where: { key },
      data: {
        responseStatus: 201,
        responseBody: jsonBody
      }
    });

    return { status: 201, body: jsonBody };
  } catch (error) {
    await prisma.idempotencyRecord.delete({ where: { key } }).catch(() => undefined);
    throw error;
  }
}
