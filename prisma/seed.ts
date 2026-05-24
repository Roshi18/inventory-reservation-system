import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const [keyboard, headphones] = await prisma.$transaction([
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard",
        description: "Hot-swappable keyboard for high-volume fulfillment."
      }
    }),
    prisma.product.create({
      data: {
        name: "Wireless Headphones",
        description: "Noise-cancelling headphones with regional stock."
      }
    })
  ]);

  const [east, west] = await prisma.$transaction([
    prisma.warehouse.create({
      data: {
        name: "East Fulfillment Center",
        location: "Newark, NJ"
      }
    }),
    prisma.warehouse.create({
      data: {
        name: "West Fulfillment Center",
        location: "Reno, NV"
      }
    })
  ]);

  await prisma.inventory.createMany({
    data: [
      { productId: keyboard.id, warehouseId: east.id, totalStock: 8, reservedStock: 0 },
      { productId: keyboard.id, warehouseId: west.id, totalStock: 1, reservedStock: 0 },
      { productId: headphones.id, warehouseId: east.id, totalStock: 4, reservedStock: 0 },
      { productId: headphones.id, warehouseId: west.id, totalStock: 12, reservedStock: 0 }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
