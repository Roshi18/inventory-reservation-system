import { z } from "zod";

export const reservationCreateSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(1000)
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
