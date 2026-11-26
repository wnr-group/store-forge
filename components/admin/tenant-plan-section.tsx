import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { SubscriptionBadge } from "@/components/admin/billing-badges";
import { FeatureOverrideSelect, ChangePlanButton, IssueInvoiceButtons, LimitOverrideButton } from "@/components/admin/tenant-plan-controls";
import { UsageBar } from "@/components/admin/usage-bar";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { money, shortDate } from "@/lib/admin/format";
import { getPlatformAccess } from "@/lib/auth/platform";
import { formatBytes } from "@/lib/utils/bytes";
import { getSubscription, getTenantBilling, getTenantEntitlements, listPlans } from "@/services/platform-commercial.service";

const SOURCE = { plan: "From the plan", unrestricted: "Unrestricted plan", override: "Exception for this organization" } as const;

/**
 * One organization's plan, what it may use, how much it uses, and its billing position, with the controls each role is allowed. Everything
 * is read from the API; a part the signed-in role cannot read is left out, and a part that fails says so instead of breaking the page.
 */
export async function TenantPlanSection({ tenantId }: { tenantId: string }) {
  const access = await getPlatformAccess();
  const can = (p: string) => access?.permissions.includes(p as never) ?? false;
  const [sub, ent, billing, plans] = await Promise.all([
    getSubscription(tenantId).catch(() => null),
    getTenantEntitlements(tenantId).catch(() => null),
    can("billing:read") ? getTenantBilling(tenantId).catch(() => null) : null,
    can("subscriptions:manage") ? listPlans({ status: "active", limit: 100, page: 1 }).catch(() => null) : null,
  ]);

  if (!sub || !ent)
    return (
      <SectionCard title="Plan, features and limits">
        <p className="text-sm text-muted-foreground">The plan could not be loaded right now. Refresh to try again.</p>
      </SectionCard>
    );

  const canManagePlan = can("subscriptions:manage") && plans !== null;
  const canExcept = can("entitlements:manage");
  const featureOverride = new Map(ent.featureOverrides.map((o) => [o.key, o.enabled]));
  const limitHasOverride = new Set(ent.limitOverrides.map((o) => o.key));
  const bytes = (n: number) => formatBytes(n);

  return (
    <SectionCard
      title="Plan, features and limits"
      description="What this organization may use comes from its plan. An exception here always wins over the plan, applies at once and is recorded in the audit log."
      aside={canManagePlan ? <ChangePlanButton tenantId={tenantId} currentPlanId={sub.plan.id} interval={sub.billingInterval} plans={plans.items.map((p) => ({ id: p.id, name: p.name, monthlyPrice: p.monthlyPrice, yearlyPrice: p.yearlyPrice, currency: p.currency, trialDays: p.trialDays }))} /> : undefined}
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Plan</dt>
          <dd className="text-sm font-medium">{sub.plan.name}{sub.plan.isUnrestricted ? <span className="font-normal text-muted-foreground"> · unrestricted</span> : null}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="text-sm"><SubscriptionBadge status={ent.subscriptionStatus} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Billing</dt>
          <dd className="text-sm capitalize">{sub.billingInterval}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{ent.subscriptionStatus === "trialing" ? "Trial ends" : "Renews"}</dt>
          <dd className="text-sm">{shortDate(ent.subscriptionStatus === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd)}</dd>
        </div>
      </dl>
      {!ent.entitled ? <p role="alert" className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-destructive">This subscription is {ent.subscriptionStatus === "canceled" ? "canceled" : "expired"}, so the organization currently has no features and cannot add anything new.</p> : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Usage against limits</h3>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Limit</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="hidden sm:table-cell">Where it comes from</TableHead>
                {canExcept ? <TableHead className="w-10"><span className="sr-only">Change</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ent.limits.map((l) => (
                <TableRow key={l.key}>
                  <TableCell>
                    <span className="block font-medium">{l.label}</span>
                    {!l.enforced ? <span className="block text-xs text-muted-foreground">Reported only; never blocks a sale</span> : l.soft !== null ? <span className="block text-xs text-muted-foreground">Warns at {l.unit === "bytes" ? bytes(l.soft) : l.soft.toLocaleString("en-IN")}</span> : null}
                  </TableCell>
                  <TableCell><UsageBar used={l.used} hard={l.hard} percent={l.percent} level={l.level} format={l.unit === "bytes" ? bytes : undefined} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{SOURCE[l.source]}</TableCell>
                  {canExcept ? (
                    <TableCell>
                      <LimitOverrideButton tenantId={tenantId} limitKey={l.key} label={l.label} unit={l.unit} soft={l.soft} hard={l.hard} hasOverride={limitHasOverride.has(l.key)} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Features</h3>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableBody>
              {ent.features.map((f) => (
                <TableRow key={f.key}>
                  <TableCell className="w-8">
                    {f.enabled ? <Check className="size-4 text-success-text" aria-hidden /> : <Minus className="size-4 text-muted-foreground/60" aria-hidden />}
                    <span className="sr-only">{f.enabled ? "Available" : "Not available"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block font-medium">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.group}</span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {f.source === "override" ? <StatusBadge tone="info">Exception</StatusBadge> : SOURCE[f.source]}
                  </TableCell>
                  <TableCell className="text-right">
                    <FeatureOverrideSelect tenantId={tenantId} featureKey={f.key} label={f.label} current={featureOverride.get(f.key) ?? null} canEdit={canExcept} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {billing ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Billing</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            {billing.openInvoices === 0 ? "No unpaid invoice." : `${billing.openInvoices} unpaid invoice${billing.openInvoices === 1 ? "" : "s"}${billing.overdue ? `, overdue: ${money(billing.overdueAmountMinor, sub.plan.currency)}` : ""}.`}{" "}
            <Link href={`${ROUTES.adminInvoices}?org=${tenantId}`} className="underline">All invoices</Link>
          </p>
          {billing.recentInvoices.length > 0 ? (
            <ul className="mb-3 divide-y rounded-lg border text-sm">
              {billing.recentInvoices.slice(0, 4).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <Link href={`${ROUTES.adminInvoices}/${i.id}`} className="font-medium hover:underline">{i.number}</Link>
                  <span className="tabular-nums text-muted-foreground">{money(i.totalMinor, i.currency)} · {i.status === "open" && i.overdue ? "Overdue" : i.status === "open" ? "Unpaid" : i.status === "paid" ? "Paid" : "Void"}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {can("billing:manage") && !sub.plan.isUnrestricted && sub.plan.monthlyPriceMinor + sub.plan.yearlyPriceMinor > 0 ? <IssueInvoiceButtons tenantId={tenantId} /> : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
