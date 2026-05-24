export type ProductInventoryResponse = {
  products: Array<{
    id: string;
    name: string;
    description: string;
    createdAt: string;
    warehouses: Array<{
      inventoryId: string;
      warehouseId: string;
      warehouseName: string;
      warehouseLocation: string;
      totalStock: number;
      reservedStock: number;
      availableStock: number;
    }>;
  }>;
};

export type ReservationResponse = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
    createdAt: string;
  };
};

export type ApiErrorResponse = {
  error: string;
  details?: unknown;
};
