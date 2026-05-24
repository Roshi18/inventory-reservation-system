import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { releaseReservation } from "@/lib/reservation-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await releaseReservation(id);
    return NextResponse.json(reservation);
  } catch (error) {
    return apiError(error);
  }
}
