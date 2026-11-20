import type { Metadata } from "next";
import { Boxes, SearchX } from "lucide-react";
import { z } from "zod";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listAdjustments, listInventory } from "@/services/inventory.service";

export const metadata: Metadata = { title: "Inventory" };

const querySchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  stock: z.enum(["all", "in", "low", "out", "untracked"]).catch("all").default("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = querySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { active, store } = await requireWorkspaceCan("catalog:view");
  const timezone = store?.timezone ?? "UTC";
  const [result, history] = await Promise.all([listInventory(query), listAdjustments(10)]);
  const filtered = Boolean(query.q) || query.stock !== "all";

  return (
    <>
      <PageHeader title="Inventory" description="Stock for every product and variant. Variants are counted separately." />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={Boxes} title="Nothing to track yet" description="Stock appears here as soon as you add products." />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search product, variant or SKU"
            filters={[
              {
                key: "stock",
                label: "Stock level",
                options: [
                  { value: "all", label: "All stock levels" },
                  { value: "in", label: "In stock" },
                  { value: "low", label: "Low stock" },
                  { value: "out", label: "Out of stock" },
                  { value: "untracked", label: "Not tracked" },
                ],
              },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No matching items" description="Try a different search or stock level." />
          ) : (
            <>
              <InventoryTable rows={result.items} canAdjust={canManageCatalog(active)} />
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.inventory} params={{ q: query.q, stock: query.stock }} />
            </>
          )}
        </>
      )}

      {history.length > 0 ? (
        <section aria-labelledby="history" className="mt-10">
          <h2 id="history" className="mb-3 text-sm font-semibold">Recent adjustments</h2>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{h.productName}</span>
                  {h.variantTitle ? <span className="text-muted-foreground"> · {h.variantTitle}</span> : null}
                  <span className="block text-xs text-muted-foreground capitalize">{h.reason}{h.note ? ` · ${h.note}` : ""}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className={h.delta > 0 ? "text-success-text" : "text-destructive"}>{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                  <span className="text-muted-foreground"> → {h.quantityAfter}</span>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(h.createdAt, timezone)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
