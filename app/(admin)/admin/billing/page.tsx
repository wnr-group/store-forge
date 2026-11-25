import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CircleDollarSign, Receipt, Undo2, XCircle } from "lucide-react";
import { BillingTabs } from "@/components/admin/billing-tabs";
import { InvoiceBadge } from "@/components/admin/billing-badges";
import { RunBillingButton } from "@/components/admin/run-billing-button";
import { StatCard } from "@/components/admin/stat-card";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { money, moneyList, shortDate } from "@/lib/admin/format";
import { getPlatformAccess, requirePlatformPagePermission } from "@/lib/auth/platform";
import { dashboardQuerySchema } from "@/lib/validations/admin-commercial";
import { getBillingSummary, listInvoices } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Billing & invoices" };

export default async function BillingOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("billing:read");
  const raw = await searchParams;
  const query = dashboardQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [s, overdue, access] = await Promise.all([
    getBillingSummary({ from: query.from, to: query.to }),
    listInvoices({ status: "overdue", page: 1, limit: 8 }),
    getPlatformAccess(),
  ]);
  const canManage = access?.permissions.includes("billing:manage") ?? false;

  return (
    <>
      <PageHeader title="Billing & invoices" description={`Revenue and payments, counted from the billing records. Payments and refunds cover ${shortDate(s.from)} to ${shortDate(s.to)}.`} actions={canManage ? <RunBillingButton /> : null} />
      <BillingTabs />
      <ListFilters dateFilters={[{ key: "from", label: "From" }, { key: "to", label: "To" }]} />

      <div className="space-y-6">
        <section aria-label="Revenue and payments" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Monthly recurring revenue" value={moneyList(s.mrr)} hint="From paid, active subscriptions. A yearly plan counts as a twelfth." icon={CircleDollarSign} />
          <StatCard label="Collected" value={moneyList(s.collected)} hint={`${s.successfulPayments} successful payment${s.successfulPayments === 1 ? "" : "s"}`} icon={Receipt} />
          <StatCard label="Refunded" value={moneyList(s.refunded)} hint={s.paymentsNeedingRefund > 0 ? `${s.paymentsNeedingRefund} payment(s) still need a refund` : "Nothing waiting for a refund"} icon={Undo2} tone={s.paymentsNeedingRefund > 0 ? "warning" : undefined} />
          <StatCard label="Failed payments" value={s.failedPayments} hint={`${s.pendingPayments} pending`} icon={XCircle} tone={s.failedPayments > 0 ? "warning" : undefined} />
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Open invoices" value={s.openInvoices} hint="Issued and not yet paid" />
          <StatCard label="Overdue invoices" value={s.overdueInvoices} hint={s.overdueInvoices > 0 ? moneyList(s.overdue) : "Nothing overdue"} icon={AlertTriangle} tone={s.overdueInvoices > 0 ? "danger" : undefined} />
          <StatCard label="Needing a refund" value={s.paymentsNeedingRefund} hint="Money received for an invoice that was already paid or void" tone={s.paymentsNeedingRefund > 0 ? "warning" : undefined} />
        </div>

        <SectionCard
          title="Overdue invoices"
          description="Open invoices past their due date. Subscriptions with an overdue invoice are marked past due, and expire after the grace period."
          aside={<Link href={`${ROUTES.adminInvoices}?status=overdue`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">View all</Link>}
        >
          {overdue.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoice is overdue.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="hidden sm:table-cell">Due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead><span className="sr-only">Status</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdue.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell><Link href={`${ROUTES.adminInvoices}/${i.id}`} className="font-medium hover:underline">{i.number}</Link></TableCell>
                      <TableCell><Link href={`${ROUTES.adminCompanies}/${i.tenantId}`} className="hover:underline">{i.tenantName}</Link></TableCell>
                      <TableCell className="hidden sm:table-cell">{shortDate(i.dueAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(i.totalMinor, i.currency)}</TableCell>
                      <TableCell><InvoiceBadge status={i.status} overdue={i.overdue} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
