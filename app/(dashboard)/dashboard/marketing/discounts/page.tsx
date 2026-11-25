import type { Metadata } from "next";
import { SearchX, TicketPercent } from "lucide-react";
import { AddDiscountButton, DiscountRowActions } from "@/components/marketing/discount-actions";
import type { DiscountDialogContext } from "@/components/marketing/discount-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManageMarketing, can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format-date";
import { DISCOUNT_STATUS, discountValueLabel, usageLabel } from "@/lib/marketing/labels";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { discountListQuerySchema, flatten } from "@/lib/validations/commerce-lists";
import { listProductOptions, listCollections } from "@/services/collection.service";
import { listCampaigns, listDiscounts } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Discounts" };

/** A list that needs a permission the member may not have (choosing products needs catalog access) is simply empty for them. */
const orEmpty = async <T,>(allowed: boolean, load: () => Promise<T[]>): Promise<T[]> => {
  if (!allowed) return [];
  try {
    return await load();
  } catch {
    return [];
  }
};

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = flatten(await searchParams);
  const query = discountListQuerySchema.parse(raw);
  const { active, store } = await requireWorkspaceCan("marketing:view");
  const currency = store?.currency ?? "INR";
  const timeZone = store?.timezone ?? "Asia/Kolkata";
  const canManage = canManageMarketing(active);
  const catalogAccess = can(active, "catalog:view");

  const [result, products, collections, campaigns] = await Promise.all([
    listDiscounts(query),
    canManage ? orEmpty(catalogAccess, () => listProductOptions()) : [],
    canManage ? orEmpty(catalogAccess, async () => (await listCollections()).map((c) => ({ id: c.id, name: c.name }))) : [],
    canManage ? orEmpty(true, async () => (await listCampaigns({ q: "", page: 1, sort: "name", dir: "asc" })).items.filter((c) => c.status !== "completed").map((c) => ({ id: c.id, name: c.name }))) : [],
  ]);
  const ctx: DiscountDialogContext = { currency, timeZone, products, collections, campaigns, catalogAccess };
  const add = canManage ? <AddDiscountButton ctx={ctx} /> : null;
  const filtered = !!query.q || !!query.status;

  return (
    <>
      <PageHeader title="Discounts" description="Codes your shoppers enter at checkout. Your store checks every code itself, so a shopper cannot change what a code is worth." actions={result.total || filtered ? add : null} />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={TicketPercent} title="No discount codes yet" description="Create a code, for example 10% off a first order, and share it with your shoppers." action={add} />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search code or note"
            filters={[
              {
                key: "status",
                label: "Status",
                options: [
                  { value: "all", label: "All" },
                  ...Object.entries(DISCOUNT_STATUS).map(([value, s]) => ({ value, label: s.label })),
                ],
              },
            ]}
            sortOptions={[
              { value: "created:desc", label: "Newest first" },
              { value: "created:asc", label: "Oldest first" },
              { value: "code:asc", label: "Code A–Z" },
              { value: "uses:desc", label: "Most used" },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No codes match" description="Try a different search or status." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Discounted</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Net sales</TableHead>
                      <TableHead className="hidden xl:table-cell">Expires</TableHead>
                      <TableHead className="w-0 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((d) => {
                      const s = DISCOUNT_STATUS[d.status];
                      return (
                        <TableRow key={d.id}>
                          <TableCell>
                            <span className="font-mono text-[13px] font-medium">{d.code}</span>
                            <span className="block text-xs text-muted-foreground">{d.campaignName ? `Campaign: ${d.campaignName}` : d.appliesTo === "all" ? "Whole bag" : d.appliesTo === "products" ? "Selected products" : "Selected collections"}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {discountValueLabel(d, currency)}
                            {d.minSubtotalMinor > 0 ? <span className="block text-xs text-muted-foreground">Min. {formatMoney(d.minSubtotalMinor, currency)}</span> : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{usageLabel(d.performance.redemptions, d.usageLimit)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(d.performance.discountTotalMinor, currency)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(d.performance.netSalesMinor, currency)}</TableCell>
                          <TableCell className="hidden text-muted-foreground xl:table-cell">{d.expiresAt ? formatDate(new Date(d.expiresAt), timeZone) : "Never"}</TableCell>
                          <TableCell>
                            <DiscountRowActions id={d.id} code={d.code} isActive={d.isActive} used={d.performance.redemptions > 0} canManage={canManage} ctx={ctx} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">“Net sales” is the item value after the discount of the paid or fulfilled orders that used the code, before refunds.</p>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.discounts} params={{ q: query.q, status: query.status, sort: raw.sort, dir: raw.dir }} />
            </>
          )}
        </>
      )}
    </>
  );
}
