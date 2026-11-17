import "server-only";
import type { z } from "zod";
import type { InventoryAdjustment } from "@/lib/domain/entities";
import { adjustStockApi, listAdjustmentsApi, listInventoryApi } from "@/lib/api/endpoints/inventory-api";
import { requireActiveTenant } from "@/lib/tenant/context";
import { PAGE_SIZE, type inventoryAdjustSchema } from "@/lib/validations/catalog";
import type { Paged } from "./product.service";

/** Stock overview, the adjustment ledger and stock changes, served by the StoreForge API (`/inventory`). */
export type StockState = "in" | "low" | "out" | "untracked";

export type InventoryRow = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  tracked: boolean;
  threshold: number;
  state: StockState;
};

export type InventoryQuery = { q: string; stock: "all" | StockState; page: number };

/**
 * One row per sellable unit: a simple product, or each ACTIVE variant of a product with variants.
 * Stock is never shared between variants.
 */
export async function listInventory(query: InventoryQuery): Promise<Paged<InventoryRow>> {
  const { tenant } = await requireActiveTenant();
  const { items, meta } = await listInventoryApi(tenant.id, { page: query.page, limit: PAGE_SIZE, search: query.q, stock: query.stock });
  return { items, total: meta.total, page: meta.page, pageSize: PAGE_SIZE };
}

export type AdjustmentRow = InventoryAdjustment & { productName: string; variantTitle: string | null };

export async function listAdjustments(limit = 15): Promise<AdjustmentRow[]> {
  const { tenant } = await requireActiveTenant();
  return (await listAdjustmentsApi(tenant.id, limit)).map((a) => ({
    ...a,
    tenantId: tenant.id,
    reason: a.reason as AdjustmentRow["reason"],
    createdAt: new Date(a.createdAt),
  }));
}

/**
 * Changes stock and writes the ledger row. The API does both in ONE transaction with the row locked (FOR UPDATE), so
 * concurrent adjustments serialise, and stock can never go below zero.
 */
export type AdjustStockInput = Omit<z.output<typeof inventoryAdjustSchema>, "note"> & { note?: string | null };

export async function adjustStock(v: AdjustStockInput): Promise<{ quantity: number }> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return adjustStockApi(tenant.id, v);
}
