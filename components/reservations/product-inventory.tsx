"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { ApiErrorResponse, ProductInventoryResponse } from "@/types/api";

type Quantities = Record<string, number>;

export function ProductInventory() {
  const router = useRouter();
  const [data, setData] = useState<ProductInventoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Quantities>({});
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const loadProducts = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const body = (await response.json()) as ProductInventoryResponse | ApiErrorResponse;
      if (!response.ok) {
        throw new Error("error" in body ? body.error : "Unable to load inventory");
      }
      setData(body as ProductInventoryResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function reserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;
    const quantity = quantities[key] ?? 1;
    setError(null);
    setSuccess(null);
    setPendingKey(key);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify({ productId, warehouseId, quantity })
      });

      const body = await response.json();
      if (!response.ok) {
        const message =
          response.status === 409
            ? "HTTP 409: insufficient stock. Another checkout may have reserved it first."
            : body.error ?? "Reservation failed";
        throw new Error(message);
      }

      setSuccess("Reservation created. Redirecting to checkout.");
      startRefresh(() => router.refresh());
      await loadProducts();
      router.push(`/reservations/${body.id}`);
    } catch (reserveError) {
      setError(reserveError instanceof Error ? reserveError.message : "Reservation failed");
      await loadProducts();
    } finally {
      setPendingKey(null);
    }
  }

  if (loading && !data) {
    return <Alert>Loading inventory...</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Stock is calculated as total minus reserved holds.
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadProducts()}
          disabled={loading || isRefreshing}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="grid gap-4">
        {data?.products.map((product) => (
          <section key={product.id} className="rounded-md border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{product.name}</h2>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Warehouse</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Reserved</th>
                    <th className="py-2 pr-3 font-medium">Available</th>
                    <th className="py-2 pr-3 font-medium">Qty</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {product.warehouses.map((warehouse) => {
                    const key = `${product.id}:${warehouse.warehouseId}`;
                    const pending = pendingKey === key;
                    return (
                      <tr key={warehouse.inventoryId} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{warehouse.warehouseName}</div>
                          <div className="text-xs text-muted-foreground">
                            {warehouse.warehouseLocation}
                          </div>
                        </td>
                        <td className="py-3 pr-3">{warehouse.totalStock}</td>
                        <td className="py-3 pr-3">{warehouse.reservedStock}</td>
                        <td className="py-3 pr-3 font-semibold">{warehouse.availableStock}</td>
                        <td className="py-3 pr-3">
                          <Input
                            className="w-20"
                            type="number"
                            min={1}
                            max={1000}
                            value={quantities[key] ?? 1}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [key]: Number(event.target.value)
                              }))
                            }
                          />
                        </td>
                        <td className="py-3">
                          <Button
                            size="sm"
                            onClick={() => void reserve(product.id, warehouse.warehouseId)}
                            disabled={pending || warehouse.availableStock <= 0}
                          >
                            <ShoppingCart className="h-4 w-4" />
                            {pending ? "Reserving" : "Reserve"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
