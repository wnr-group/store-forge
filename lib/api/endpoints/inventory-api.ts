import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/** `/inventory` of the StoreForge API. Dates arrive as ISO strings. */
export type InventoryRowApi = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  tracked: boolean;
  threshold: number;
  state: "in" | "low" | "out" | "untracked";
};

export type AdjustmentApi = {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantTitle: string | null;
  delta: number;
  quantityAfter: number;
  reason: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type AdjustStockApiInput = {
  productId: string;
  variantId?: string | null;
  mode: "add" | "set";
  value: number;
  reason: string;
  note?: string | null;
};

export async function listInventoryApi(
  organizationId: string,
  query: { page: number; limit: number; search?: string; stock?: string },
): Promise<{ items: InventoryRowApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<InventoryRowApi[]>("/inventory", { organizationId, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}

export const listAdjustmentsApi = async (organizationId: string, limit: number) =>
  (await apiRequest<AdjustmentApi[]>("/inventory/adjustments", { organizationId, query: { limit } })).data;

export const adjustStockApi = async (organizationId: string, input: AdjustStockApiInput) =>
  (await apiRequest<{ quantity: number }>("/inventory/adjustments", { method: "POST", json: input, organizationId })).data;
