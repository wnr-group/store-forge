import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt, SearchX } from "lucide-react";
import { InvoiceBadge } from "@/components/admin/billing-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { money, shortDate } from "@/lib/admin/format";
import { canManageBilling } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { myInvoiceListSchema } from "@/lib/validations/billing";
import { listMyInvoices } from "@/services/billing.service";

export const metadata: Metadata = { title: "Invoices" };

export default async function MyInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { active } = await requireWorkspace();
  if (!canManageBilling(active)) redirect(ROUTES.dashboard);
  const raw = await searchParams;
  const query = myInvoiceListSchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { items, meta } = await listMyInvoices({ status: query.status, page: query.page });
  const base = `${ROUTES.billing}/invoices`;

  return (
    <>
      <PageHeader title="Invoices" description="What Kanova Store has billed your organization. Open one to see its payments or download it." actions={<Link href={ROUTES.billing} className="text-sm underline">Back to plan &amp; billing</Link>} />
      {meta.total === 0 && query.status === "all" ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Invoices are issued for paid plans, before each renewal." />
      ) : (
        <>
          <ListFilters filters={[{ key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "open", label: "Unpaid" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" }] }]} />
          {meta.total === 0 ? (
            <EmptyState icon={SearchX} title="No invoices match" description="Try a different status." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Invoice</TableHead>
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
                        <TableCell><Link href={`${base}/${i.id}`} className="font-medium hover:underline">{i.number}</Link></TableCell>
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
              <Pagination page={meta.page} pageSize={meta.limit} total={meta.total} basePath={base} params={{ status: query.status }} />
            </>
          )}
        </>
      )}
    </>
  );
}
