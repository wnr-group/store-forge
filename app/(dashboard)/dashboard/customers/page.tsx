import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Users } from "lucide-react";
import { AddCustomerButton } from "@/components/customers/customer-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManageCustomers } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { customerListQuerySchema } from "@/lib/validations/catalog";
import { listCustomers } from "@/services/customer.service";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = customerListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { active, store } = await requireWorkspaceCan("customers:view");
  const result = await listCustomers(query);
  const currency = store?.currency ?? "INR";
  const timezone = store?.timezone ?? "UTC";
  const add =canManageCustomers(active) ? <AddCustomerButton /> : null;

  return (
    <>
      <PageHeader title="Customers" description="People who have bought from, or been added to, your store." actions={result.total || query.q ? add : null} />
      {result.total === 0 && !query.q ? (
        <EmptyState icon={Users} title="No customers yet" description="Customers appear here once they place an order, or you can add one yourself." action={add} />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search name, email or phone"
            sortOptions={[
              { value: "created:desc", label: "Newest first" },
              { value: "created:asc", label: "Oldest first" },
              { value: "name:asc", label: "Name A–Z" },
              { value: "spent:desc", label: "Highest spend" },
              { value: "orders:desc", label: "Most orders" },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No customers match" description="Try a different name, email or phone number." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Total spent</TableHead>
                      <TableHead className="hidden lg:table-cell">Last order</TableHead>
                      <TableHead className="hidden xl:table-cell">Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`${ROUTES.customers}/${c.id}`} className="font-medium hover:text-primary hover:underline">{c.fullName}</Link>
                          <span className="block text-xs text-muted-foreground">{c.email}</span>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(c.totalSpentMinor, currency)}</TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">{c.lastOrderAt ? formatDate(c.lastOrderAt, timezone) : "—"}</TableCell>
                        <TableCell className="hidden text-muted-foreground xl:table-cell">{formatDate(c.createdAt, timezone)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.customers} params={{ q: query.q, sort: raw.sort as string | undefined, dir: raw.dir as string | undefined }} />
            </>
          )}
        </>
      )}
    </>
  );
}
