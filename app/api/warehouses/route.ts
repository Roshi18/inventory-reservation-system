import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { listWarehouses } from "@/lib/reservation-service";

export async function GET() {
  try {
    const warehouses = await listWarehouses();
    return NextResponse.json({ warehouses });
  } catch (error) {
    return apiError(error);
  }
}
