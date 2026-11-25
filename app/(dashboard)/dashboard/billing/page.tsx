import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Check, Minus } from "lucide-react";
import { InvoiceBadge, SubscriptionBadge } from "@/components/admin/billing-badges";
import { UsageBar } from "@/components/admin/usage-bar";
import { PayInvoiceButton } from "@/components/billing/pay-invoice-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { money, shortDate } from "@/lib/admin/format";
import { canManageBilling } from "@/lib/auth/permissions";
import { bytesText } from "@/lib/billing/format";
import { requireWorkspace } from "@/lib/tenant/context";
import { getMyBilling, getMyEntitlements } from "@/services/billing.service";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  const { active } = await requireWorkspace();
  // Owner-only. The service, the API and the database repeat this check; this is just the friendly redirect.
  if (!canManageBilling(active)) redirect(ROUTES.dashboard);
  const [billing, plan] = await Promise.all([getMyBilling(), getMyEntitlements(true)]);
  const unpaid = billing.recentInvoices.filter((i) => i.status === "open");
  const trialEnd = plan.subscriptionStatus === "trialing" ? plan.trialEndsAt : null;

  return (
    <>
      <PageHeader title="Plan & billing" description={`Your StoreForge plan, what ${active.tenant.name} has used, and what you owe.`} />

      {!plan.entitled ? (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>Your subscription is {plan.subscriptionStatus === "expired" ? "expired" : "not active"}, so paid features are switched off. Pay any unpaid invoice below, or contact StoreForge.</span>
        </div>
      ) : billing.overdue ? (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
          <span>You have an overdue invoice. Pay it soon to keep your plan active.</span>
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Your plan" aside={<SubscriptionBadge status={plan.subscriptionStatus} />}>
            <dl className="divide-y text-sm">
              <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Plan</dt><dd className="font-medium">{plan.planName}</dd></div>
              <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Billed</dt><dd>{billing.billingInterval === "yearly" ? "Yearly" : billing.billingInterval === "monthly" ? "Monthly" : "—"}</dd></div>
              {trialEnd ? <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Trial ends</dt><dd>{shortDate(trialEnd)}</dd></div> : null}
              <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Renews</dt><dd>{shortDate(billing.renewsAt)}</dd></div>
              <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Unpaid invoices</dt><dd className="tabular-nums">{billing.openInvoices}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">To change your plan, contact StoreForge. Plans are assigned by StoreForge, not bought here.</p>
          </SectionCard>

          <SectionCard title="Usage" description="How much of each limit you have used.">
            <ul className="space-y-3">
              {plan.limits.map((l) => (
                <li key={l.key} className="space-y-1">
                  <span className="text-sm font-medium">{l.label}</span>
                  <UsageBar used={l.used} hard={l.hard} percent={l.percent} level={l.level} format={l.unit === "bytes" ? bytesText : undefined} />
                  {!l.enforced ? <span className="block text-xs text-muted-foreground">Shown for your information; it does not stop you.</span> : null}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Features" description="What your plan includes.">
          <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {plan.features.map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                {f.enabled ? <Check className="size-4 text-success-text" aria-hidden /> : <Minus className="size-4 text-muted-foreground" aria-hidden />}
                <span className={f.enabled ? "" : "text-muted-foreground"}>{f.label}</span>
                <span className="sr-only">{f.enabled ? "included" : "not included"}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {unpaid.length > 0 ? (
          <SectionCard title="To pay" description="Payments go through Razorpay. Your card or bank details are entered in Razorpay's window and never reach StoreForge.">
            <ul className="divide-y">
              {unpaid.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`${ROUTES.billing}/invoices/${i.id}`} className="font-medium hover:underline">{i.number}</Link>
                    <p className="text-xs text-muted-foreground">{i.planName} plan · due {shortDate(i.dueAt)}{i.overdue ? " · overdue" : ""}</p>
                  </div>
                  <PayInvoiceButton invoiceId={i.id} number={i.number} totalMinor={i.totalMinor} currency={i.currency} />
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard title="Recent invoices" aside={<Link href={`${ROUTES.billing}/invoices`} className="text-sm underline">All invoices</Link>}>
          {billing.recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Invoices are issued for paid plans, before each renewal.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Invoice</TableHead>
                    <TableHead className="hidden sm:table-cell">Issued</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.recentInvoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell><Link href={`${ROUTES.billing}/invoices/${i.id}`} className="font-medium hover:underline">{i.number}</Link></TableCell>
                      <TableCell className="hidden sm:table-cell">{shortDate(i.issuedAt)}</TableCell>
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
