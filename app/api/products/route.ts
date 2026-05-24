import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { listProductsWithInventory } from "@/lib/reservation-service";

export async function GET() {
  try {
    const products = await listProductsWithInventory();
    return NextResponse.json({ products });
  } catch (error) {
    return apiError(error);
  }
}
