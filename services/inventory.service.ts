import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { inventoryAdjustments, products, productVariants, type InventoryAdjustment } from "@/lib/db/schema";
import { mapErrors } from "@/lib/db/errors";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import { withTenantDb } from "@/lib/tenant/context";
import type { z } from "zod";
import { PAGE_SIZE, type inventoryAdjustSchema } from "@/lib/validations/catalog";
import type { Paged } from "./product.service";

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
  return withTenantDb({}, async (tx, ctx) => {
    const term = query.q ? `%${query.q.replace(/[%_\\]/g, "\\$&")}%` : null;
    const filters = sql`
      where u.tenant_id = ${ctx.tenantId}
      ${term ? sql`and (u.product_name ilike ${term} or u.sku ilike ${term} or u.variant_title ilike ${term})` : sql``}
      ${query.stock === "all" ? sql`` : sql`and u.state = ${query.stock}`}`;
    const units = sql`(
      select p.tenant_id, p.id as product_id, null::uuid as variant_id, p.name as product_name, null::text as variant_title,
             p.sku, p.quantity, p.track_inventory as tracked, p.low_stock_threshold as threshold,
             case when not p.track_inventory then 'untracked' when p.quantity <= 0 then 'out'
                  when p.quantity <= p.low_stock_threshold then 'low' else 'in' end as state
      from public.products p where not p.has_variants
      union all
      select v.tenant_id, p.id, v.id, p.name, v.title, v.sku, v.quantity, p.track_inventory, p.low_stock_threshold,
             case when not p.track_inventory then 'untracked' when v.quantity <= 0 then 'out'
                  when v.quantity <= p.low_stock_threshold then 'low' else 'in' end
      from public.product_variants v join public.products p on p.id = v.product_id
      where p.has_variants and v.is_active
    ) u`;

    const rows = rowsOf<Record<string, unknown>>(
      await tx.execute(sql`
        select u.product_id, u.variant_id, u.product_name, u.variant_title, u.sku, u.quantity::int as quantity,
               u.tracked, u.threshold::int as threshold, u.state
        from ${units} ${filters}
        order by (case u.state when 'out' then 0 when 'low' then 1 else 2 end), u.product_name, u.variant_title nulls first
        limit ${PAGE_SIZE} offset ${(query.page - 1) * PAGE_SIZE}`),
    );
    const [{ total }] = rowsOf<{ total: number }>(await tx.execute(sql`select count(*)::int as total from ${units} ${filters}`));
    return {
      items: rows.map((r) => ({
        productId: r.product_id as string,
        variantId: (r.variant_id as string | null) ?? null,
        productName: r.product_name as string,
        variantTitle: (r.variant_title as string | null) ?? null,
        sku: (r.sku as string | null) ?? null,
        quantity: Number(r.quantity),
        tracked: Boolean(r.tracked),
        threshold: Number(r.threshold),
        state: r.state as StockState,
      })),
      total,
      page: query.page,
      pageSize: PAGE_SIZE,
    };
  });
}

export type AdjustmentRow = InventoryAdjustment & { productName: string; variantTitle: string | null };

export async function listAdjustments(limit = 15): Promise<AdjustmentRow[]> {
  return withTenantDb({}, async (tx, ctx) => {
    const rows = await tx
      .select({ adj: inventoryAdjustments, productName: products.name, variantTitle: productVariants.title })
      .from(inventoryAdjustments)
      .innerJoin(products, eq(products.id, inventoryAdjustments.productId))
      .leftJoin(productVariants, eq(productVariants.id, inventoryAdjustments.variantId))
      .where(eq(inventoryAdjustments.tenantId, ctx.tenantId))
      .orderBy(desc(inventoryAdjustments.createdAt))
      .limit(limit);
    return rows.map((r) => ({ ...r.adj, productName: r.productName, variantTitle: r.variantTitle }));
  });
}

/**
 * Changes stock and writes the ledger row in ONE transaction. The row is locked
 * (FOR UPDATE) so concurrent adjustments serialise, and the quantity >= 0 CHECK
 * constraint is the final guard against negative stock.
 */
export type AdjustStockInput = Omit<z.output<typeof inventoryAdjustSchema>, "note"> & { note?: string | null };

export async function adjustStock(v: AdjustStockInput): Promise<{ quantity: number }> {
  return withTenantDb({ permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      const [product] = await tx
        .select({ id: products.id, track: products.trackInventory, hasVariants: products.hasVariants, quantity: products.quantity })
        .from(products)
        .where(and(eq(products.id, v.productId), eq(products.tenantId, ctx.tenantId)))
        .for("update");
      if (!product) throw new AppError("NOT_FOUND", "That product no longer exists.");
      if (!product.track) throw new AppError("VALIDATION", "Inventory is not tracked for this product. Turn on tracking first.");

      let current: number;
      if (product.hasVariants) {
        if (!v.variantId) throw new AppError("VALIDATION", "Choose which variant to adjust.");
        const [variant] = await tx
          .select({ quantity: productVariants.quantity })
          .from(productVariants)
          .where(and(eq(productVariants.id, v.variantId), eq(productVariants.productId, v.productId), eq(productVariants.tenantId, ctx.tenantId)))
          .for("update");
        if (!variant) throw new AppError("NOT_FOUND", "That variant no longer exists.");
        current = variant.quantity;
      } else {
        if (v.variantId) throw new AppError("VALIDATION", "This product has no variants.");
        current = product.quantity;
      }

      const next = v.mode === "set" ? v.value : current + v.value;
      if (next < 0) throw new AppError("VALIDATION", `Stock cannot go below zero (currently ${current}).`, { value: "Would make stock negative" });
      const delta = next - current;
      if (delta === 0) throw new AppError("VALIDATION", "That is already the current stock level.", { value: "No change" });

      if (v.variantId) await tx.update(productVariants).set({ quantity: next }).where(eq(productVariants.id, v.variantId));
      else await tx.update(products).set({ quantity: next }).where(eq(products.id, v.productId));
      await tx.insert(inventoryAdjustments).values({
        tenantId: ctx.tenantId,
        productId: v.productId,
        variantId: v.variantId,
        delta,
        quantityAfter: next,
        reason: v.reason,
        note: v.note ?? null,
        createdBy: ctx.userId,
      });
      return { quantity: next };
    }),
  );
}

export const inventoryOrder = { asc, desc };
