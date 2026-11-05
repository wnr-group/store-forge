import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, Phone, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { CustomerDetailActions } from "@/components/customers/customer-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canDeleteCustomers, canManageCustomers } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/money";
import { requireWorkspace } from "@/lib/tenant/context";
import { getCustomer } from "@/services/customer.service";

export const metadata: Metadata = { title: "Customer" };

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const TONES: Record<string, Tone> = { paid: "active", fulfilled: "active", pending: "warning", cancelled: "draft", refunded: "danger" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { active, store } = await requireWorkspace();
  const data = await getCustomer(id);
  if (!data) notFound();
  const { customer: c, orders } = data;
  const currency = store?.currency ?? "INR";

  return (
    <>
      <PageHeader
        title={c.fullName}
        description={`Customer since ${date.format(c.createdAt)}`}
        actions={<CustomerDetailActions customer={{ id: c.id, fullName: c.fullName, email: c.email, phone: c.phone, notes: c.notes }} canManage={canManageCustomers(active.role)} canDelete={canDeleteCustomers(active.role)} />}
      />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Contact">
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" aria-hidden /><dt className="sr-only">Email</dt><dd className="min-w-0 break-all">{c.email}</dd></div>
              <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" aria-hidden /><dt className="sr-only">Phone</dt><dd>{c.phone ?? <span className="text-muted-foreground">No phone</span>}</dd></div>
            </dl>
            {c.notes ? <p className="whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground">{c.notes}</p> : null}
          </SectionCard>
          <SectionCard title="Summary">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Orders</dt><dd className="text-lg font-semibold tabular-nums">{c.orderCount}</dd></div>
              <div><dt className="text-muted-foreground">Total spent</dt><dd className="text-lg font-semibold tabular-nums">{formatMoney(c.totalSpentMinor, currency)}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Last order</dt><dd>{c.lastOrderAt ? date.format(c.lastOrderAt) : "—"}</dd></div>
            </dl>
          </SectionCard>
        </div>
        <SectionCard title="Order history">
          {orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" description="Orders placed by this customer will appear here." className="border-0 py-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-[13px] font-medium tabular-nums">#{o.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{date.format(o.placedAt)}</TableCell>
                    <TableCell><StatusBadge tone={TONES[o.status] ?? "neutral"}><span className="capitalize">{o.status}</span></StatusBadge></TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(o.totalMinor, o.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </>
  );
}
