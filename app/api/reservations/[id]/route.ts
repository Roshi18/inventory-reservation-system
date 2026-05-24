import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { getReservation } from "@/lib/reservation-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await getReservation(id);
    return NextResponse.json(reservation);
  } catch (error) {
    return apiError(error);
  }
}
