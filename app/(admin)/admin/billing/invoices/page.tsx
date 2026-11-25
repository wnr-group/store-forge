import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, SearchX } from "lucide-react";
import { BillingTabs } from "@/components/admin/billing-tabs";
import { InvoiceBadge } from "@/components/admin/billing-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { money, shortDate } from "@/lib/admin/format";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import { invoiceListQuerySchema } from "@/lib/validations/admin-commercial";
import { ADMIN_PAGE_SIZES } from "@/lib/validations/admin-list";
import { listInvoices } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("billing:read");
  const raw = await searchParams;
  const query = invoiceListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { items, meta } = await listInvoices({ search: query.q, status: query.status, org: query.org, from: query.from, to: query.to, page: query.page, limit: query.pageSize });
  const filtered = Boolean(query.q || query.org || query.from || query.to) || query.status !== "all";

  return (
    <>
      <PageHeader title="Invoices" description="Every invoice issued to an organization. Open one to see its payments, download it, or settle it." />
      <BillingTabs />
      {meta.total === 0 && !filtered ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Invoices are issued for paid plans: automatically before each renewal, or from an organization's page." />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search by invoice number or organization"
            filters={[{ key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "open", label: "Unpaid" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" }] }]}
            dateFilters={[{ key: "from", label: "Issued from" }, { key: "to", label: "to" }]}
          />
          {query.org ? <p className="mb-3 text-sm text-muted-foreground">Showing one organization only. <Link href={ROUTES.adminInvoices} className="underline">Show all</Link></p> : null}
          {meta.total === 0 ? (
            <EmptyState icon={SearchX} title="No invoices match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Invoice</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="hidden md:table-cell">Plan</TableHead>
                      <TableHead className="hidden sm:table-cell">Issued</TableHead>
                      <TableHead className="hidden lg:table-cell">Due</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell><Link href={`${ROUTES.adminInvoices}/${i.id}`} className="font-medium hover:underline">{i.number}</Link></TableCell>
                        <TableCell><Link href={`${ROUTES.adminCompanies}/${i.tenantId}`} className="hover:underline">{i.tenantName}</Link></TableCell>
                        <TableCell className="hidden md:table-cell">{i.planName} <span className="text-xs text-muted-foreground">({i.billingInterval})</span></TableCell>
                        <TableCell className="hidden sm:table-cell">{shortDate(i.issuedAt)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{shortDate(i.dueAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(i.totalMinor, i.currency)}</TableCell>
                        <TableCell><InvoiceBadge status={i.status} overdue={i.overdue} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={meta.page}
                pageSize={meta.limit}
                total={meta.total}
                basePath={ROUTES.adminInvoices}
                params={{ q: query.q, status: query.status, org: query.org, from: query.from, to: query.to, pageSize: String(meta.limit) }}
                pageSizeOptions={ADMIN_PAGE_SIZES}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
