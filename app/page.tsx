import { ProductInventory } from "@/components/reservations/product-inventory";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Order fulfillment</p>
        <h1 className="text-3xl font-semibold tracking-normal">Inventory reservations</h1>
        <p className="max-w-2xl text-muted-foreground">
          Reserve stock by warehouse, confirm purchases, and release abandoned checkout holds.
        </p>
      </div>
      <ProductInventory />
    </div>
  );
}
