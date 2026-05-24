import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { reservationCreateSchema } from "@/lib/schemas";
import {
  createReservation,
  getIdempotentReservation,
  requestHash
} from "@/lib/reservation-service";

export async function POST(request: NextRequest) {
  try {
    const input = reservationCreateSchema.parse(await request.json());
    const idempotencyKey = request.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      const response = await getIdempotentReservation(
        idempotencyKey,
        requestHash(input),
        () => createReservation(input)
      );
      return NextResponse.json(response.body, { status: response.status });
    }

    const reservation = await createReservation(input);
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
