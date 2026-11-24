import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, SearchX } from "lucide-react";
import { BillingTabs } from "@/components/admin/billing-tabs";
import { PaymentBadge } from "@/components/admin/billing-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { dateTime, money } from "@/lib/admin/format";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import { paymentListQuerySchema } from "@/lib/validations/admin-commercial";
import { ADMIN_PAGE_SIZES } from "@/lib/validations/admin-list";
import { listPayments } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("billing:read");
  const raw = await searchParams;
  const query = paymentListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { items, meta } = await listPayments({
    search: query.q,
    status: query.status,
    org: query.org,
    from: query.from,
    to: query.to,
    refundRequired: query.refundRequired,
    page: query.page,
    limit: query.pageSize,
  });
  const filtered = Boolean(query.q || query.org || query.from || query.to || query.refundRequired) || query.status !== "all";

  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt: successful, failed, pending and refunded, with the Razorpay reference. Times are UTC." />
      <BillingTabs />
      {meta.total === 0 && !filtered ? (
        <EmptyState icon={Banknote} title="No payments yet" description="Payments appear here when a tenant pays an invoice or you record an offline payment." />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search by invoice, tenant, Razorpay id or reference"
            filters={[
              { key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "succeeded", label: "Successful" }, { value: "failed", label: "Failed" }, { value: "pending", label: "Pending" }, { value: "partially_refunded", label: "Partly refunded" }, { value: "refunded", label: "Refunded" }] },
              { key: "refundRequired", label: "Refund", options: [{ value: "all", label: "Any" }, { value: "true", label: "Needs a refund" }] },
            ]}
            dateFilters={[{ key: "from", label: "From" }, { key: "to", label: "to" }]}
          />
          {meta.total === 0 ? (
            <EmptyState icon={SearchX} title="No payments match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>When</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="hidden md:table-cell">Tenant</TableHead>
                      <TableHead className="hidden lg:table-cell">Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-sm">{dateTime(p.capturedAt ?? p.createdAt)}</TableCell>
                        <TableCell><Link href={`${ROUTES.adminInvoices}/${p.invoiceId}`} className="font-medium hover:underline">{p.invoiceNumber}</Link></TableCell>
                        <TableCell className="hidden md:table-cell"><Link href={`${ROUTES.adminCompanies}/${p.tenantId}`} className="hover:underline">{p.tenantName}</Link></TableCell>
                        <TableCell className="hidden max-w-56 truncate text-xs text-muted-foreground lg:table-cell">
                          {p.provider === "razorpay" ? `Razorpay ${p.razorpayPaymentId ?? p.razorpayOrderId ?? ""}` : `${p.method ?? "Offline"} ${p.reference ?? ""}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(p.amountMinor, p.currency)}
                          {p.refundedMinor > 0 ? <span className="block text-xs text-muted-foreground">{money(p.refundedMinor, p.currency)} refunded</span> : null}
                        </TableCell>
                        <TableCell>
                          <PaymentBadge status={p.status} />
                          {p.refundRequired ? <span className="mt-1 block text-xs text-warning-text">Needs a refund</span> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={meta.page}
                pageSize={meta.limit}
                total={meta.total}
                basePath={ROUTES.adminPayments}
                params={{ q: query.q, status: query.status, org: query.org, from: query.from, to: query.to, refundRequired: query.refundRequired, pageSize: String(meta.limit) }}
                pageSizeOptions={ADMIN_PAGE_SIZES}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
