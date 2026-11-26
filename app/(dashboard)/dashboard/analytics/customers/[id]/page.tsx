import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatTile } from "@/components/analytics/stat-tile";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canViewOrders } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten } from "@/lib/validations/commerce-lists";
import { getCustomerHistory } from "@/services/marketing.service";
import { labelFor, ORDER_STATUS_LABELS } from "@/components/orders/order-labels";

export const metadata: Metadata = { title: "Customer history" };

export default async function CustomerHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = Math.max(1, Math.min(100_000, Number(flatten(await searchParams).page) || 1));
  const { active, store } = await requireWorkspaceCan("customers:view");
  const h = await getCustomerHistory(id, page).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!h) notFound();
  const currency = store?.currency ?? "INR";
  const timeZone = store?.timezone ?? "Asia/Kolkata";
  const money = (m: number) => formatMoney(m, currency);
  const canOpenOrders = canViewOrders(active);

  return (
    <>
      <Link href={ROUTES.analyticsCustomers} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Customer analytics
      </Link>
      <PageHeader title={h.fullName} description={h.email} actions={<Link href={`${ROUTES.customers}/${h.customerId}`} className="text-sm underline-offset-4 hover:underline">Customer record</Link>} />
      <div className="grid max-w-4xl gap-6">
        <section aria-label="Lifetime" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Orders" value={String(h.lifetimeOrders)} hint="That count as sales, ever" />
          <StatTile label="Total spent" value={money(h.lifetimeRevenueMinor)} />
          <StatTile label="Average order" value={money(h.averageOrderValueMinor)} />
          <StatTile label="First and last order" value={h.firstOrderAt ? formatDate(new Date(h.firstOrderAt), timeZone) : "None"} hint={h.lastOrderAt ? `Last: ${formatDate(new Date(h.lastOrderAt), timeZone)}` : undefined} />
        </section>
        <SectionCard title="Purchase history" description={`${h.totalOrders} order${h.totalOrders === 1 ? "" : "s"} in all, newest first. Orders that are cancelled, failed or unpaid are shown but are not part of the totals above.`}>
          {h.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="hidden md:table-cell">Placed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {h.orders.map((o) => (
                      <TableRow key={o.id} className={o.countsAsSale ? undefined : "text-muted-foreground"}>
                        <TableCell>
                          {canOpenOrders ? (
                            <Link href={`${ROUTES.orders}/${o.id}`} className="font-medium hover:text-primary hover:underline">
                              #{o.orderNumber}
                            </Link>
                          ) : (
                            <span className="font-medium">#{o.orderNumber}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={o.countsAsSale ? "active" : "draft"}>{labelFor(ORDER_STATUS_LABELS, o.status)}</StatusBadge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{o.itemCount}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{o.discountMinor > 0 ? money(o.discountMinor) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(o.totalMinor)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatDateTime(new Date(o.placedAt), timeZone)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={h.page} pageSize={h.limit} total={h.totalOrders} basePath={`${ROUTES.analyticsCustomers}/${h.customerId}`} params={{}} />
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}
