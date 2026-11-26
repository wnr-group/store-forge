import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ShoppingBasket } from "lucide-react";
import { StatTile } from "@/components/analytics/stat-tile";
import { AbandonedCartSettings } from "@/components/marketing/abandoned-cart-settings";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManageMarketing, canManageStore } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { CART_STATUS } from "@/lib/marketing/labels";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { abandonedCartListQuerySchema, flatten } from "@/lib/validations/commerce-lists";
import { getAbandonedCartSettings, getAbandonedCartSummary, listAbandonedCarts } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Abandoned carts" };

export default async function AbandonedCartsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = flatten(await searchParams);
  const query = abandonedCartListQuerySchema.parse(raw);
  const { active, store } = await requireWorkspaceCan("marketing:view");
  const currency = store?.currency ?? "INR";
  const timeZone = store?.timezone ?? "Asia/Kolkata";
  const [result, summary, settings] = await Promise.all([listAbandonedCarts(query), getAbandonedCartSummary({ from: query.from, to: query.to }), getAbandonedCartSettings()]);
  const money = (m: number) => formatMoney(m, currency);
  const filtered = !!query.q || !!query.status || !!query.from || !!query.to;
  const nothingEver = result.total === 0 && !filtered && summary.abandonedCount + summary.recoveredCount + summary.activeCount === 0;

  return (
    <>
      <PageHeader title="Abandoned carts" description="Shoppers who typed their email at checkout and did not finish. Nothing is sent to anyone from here: you can see who they are and copy a link that puts their bag back." />
      <div className="grid gap-6">
        <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Abandoned" value={String(summary.abandonedCount)} hint={`Worth ${money(summary.abandonedValueMinor)}`} />
          <StatTile label="Recovered" value={String(summary.recoveredCount)} hint={`Orders worth ${money(summary.recoveredValueMinor)}`} />
          <StatTile label="Recovery rate" value={`${summary.recoveryRatePercent}%`} hint="Recovered out of all that were abandoned" />
          <StatTile label="Still shopping" value={String(summary.activeCount)} hint={`${summary.from} to ${summary.to}`} />
        </section>

        {nothingEver ? (
          <EmptyState icon={ShoppingBasket} title="No saved carts yet" description="A cart is saved once a shopper types their email at checkout. When one goes quiet it shows up here." />
        ) : (
          <div className="grid gap-3">
            <ListFilters
              searchPlaceholder="Search name or email"
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: [
                    { value: "all", label: "All" },
                    ...Object.entries(CART_STATUS).map(([value, s]) => ({ value, label: s.label })),
                  ],
                },
              ]}
              dateFilters={[
                { key: "from", label: "From" },
                { key: "to", label: "To" },
              ]}
              sortOptions={[
                { value: "recent:desc", label: "Most recent" },
                { value: "recent:asc", label: "Oldest" },
                { value: "value:desc", label: "Highest value" },
              ]}
            />
            {result.items.length === 0 ? (
              <EmptyState icon={SearchX} title="No carts match" description="Try a different status, name or dates." />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Shopper</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="hidden md:table-cell">Last activity</TableHead>
                        <TableHead className="hidden lg:table-cell">Abandoned</TableHead>
                        <TableHead className="hidden xl:table-cell">May contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.items.map((c) => {
                        const s = CART_STATUS[c.status];
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Link href={`${ROUTES.abandonedCarts}/${c.id}`} className="font-medium hover:text-primary hover:underline">
                                {c.customerName || c.email || "Unknown shopper"}
                              </Link>
                              {c.customerName && c.email ? <span className="block text-xs text-muted-foreground">{c.email}</span> : null}
                            </TableCell>
                            <TableCell>
                              <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                              {c.status === "recovered" && c.recoveredOrderNumber ? <span className="block text-xs text-muted-foreground">Order #{c.recoveredOrderNumber}</span> : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{c.itemCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(c.cartValueMinor)}</TableCell>
                            <TableCell className="hidden text-muted-foreground md:table-cell">{formatDateTime(new Date(c.lastActivityAt), timeZone)}</TableCell>
                            <TableCell className="hidden text-muted-foreground lg:table-cell">{c.abandonedAt ? formatDateTime(new Date(c.abandonedAt), timeZone) : "—"}</TableCell>
                            <TableCell className="hidden xl:table-cell">{c.canContact ? "Agreed" : "No"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.abandonedCarts} params={{ q: query.q, status: query.status, from: query.from, to: query.to, sort: raw.sort, dir: raw.dir }} />
              </>
            )}
          </div>
        )}

        <div className="max-w-3xl">
          <AbandonedCartSettings minutes={settings.abandonmentThresholdMinutes} days={settings.recoveryLinkDays} canManage={canManageStore(active)} />
        </div>
        {canManageMarketing(active) ? null : <p className="text-xs text-muted-foreground">You can look at saved carts, but changing or erasing them needs more access.</p>}
      </div>
    </>
  );
}
