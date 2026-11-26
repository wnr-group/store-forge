import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Tags } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import { formatBytes } from "@/lib/utils/bytes";
import type { LimitValueApi, PlanApi, PlanCatalogApi } from "@/lib/api/endpoints/platform-business-api";
import { getPlanCatalog, listPlans } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Feature entitlements" };

const limitText = (v: LimitValueApi, unit: "count" | "bytes") => {
  const f = (n: number) => (unit === "bytes" ? formatBytes(n) : n.toLocaleString("en-IN"));
  if (v.hard === null && v.soft === null) return "Unlimited";
  return `${v.hard === null ? "Unlimited" : f(v.hard)}${v.soft === null ? "" : ` (warn at ${f(v.soft)})`}`;
};

function PlanHeads({ plans }: { plans: PlanApi[] }) {
  return (
    <>
      {plans.map((p) => (
        <TableHead key={p.id} className="text-center">
          <Link href={`${ROUTES.adminPlans}/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
          {p.status === "inactive" ? <span className="block text-[11px] font-normal text-muted-foreground">Inactive</span> : null}
        </TableHead>
      ))}
    </>
  );
}

export default async function EntitlementsPage() {
  await requirePlatformPagePermission("plans:read");
  const [catalog, { items: plans }]: [PlanCatalogApi, { items: PlanApi[] }] = await Promise.all([getPlanCatalog(), listPlans({ limit: 100, page: 1 })]);

  return (
    <>
      <PageHeader title="Feature entitlements" description="What each plan includes. An organization gets exactly what its plan lists, the moment it is assigned or the plan is edited. Edit a plan to change what it includes." />
      {plans.length === 0 ? (
        <EmptyState icon={Tags} title="No plans yet" description="Create a plan first; then this table shows what each one includes." />
      ) : (
        <div className="space-y-6">
          <SectionCard title="Features" description="A tick means the plan includes it. Unrestricted plans include everything, including features added later.">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Feature</TableHead>
                    <PlanHeads plans={plans} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.features.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell>
                        <span className="font-medium">{f.label}</span>
                        <span className="block text-xs text-muted-foreground">{f.group} · {f.description}</span>
                      </TableCell>
                      {plans.map((p) => {
                        const on = p.isUnrestricted || p.features[f.key];
                        return (
                          <TableCell key={p.id} className="text-center">
                            {on ? <Check className="mx-auto size-4 text-success-text" aria-hidden /> : <Minus className="mx-auto size-4 text-muted-foreground/60" aria-hidden />}
                            <span className="sr-only">{on ? "Included" : "Not included"}</span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title="Limits" description="The hard limit is where new items are refused; the warning level only raises a notice. A limit that is not enforced (orders) is reported but never blocks a sale.">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Limit</TableHead>
                    <PlanHeads plans={plans} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.limits.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell>
                        <span className="font-medium">{l.label}</span>
                        {!l.enforced ? <StatusBadge tone="info" className="ml-2">Report only</StatusBadge> : null}
                        <span className="block text-xs text-muted-foreground">{l.description}</span>
                      </TableCell>
                      {plans.map((p) => (
                        <TableCell key={p.id} className="text-center text-sm tabular-nums">
                          {p.isUnrestricted ? "Unlimited" : limitText(p.limits[l.key], l.unit)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <p className="text-sm text-muted-foreground">
            To give one organization something its plan does not include, or a different limit, open the organization and use <span className="font-medium">Plan, features and limits</span>. Those exceptions always win over the plan and are recorded in the audit log.
          </p>
        </div>
      )}
    </>
  );
}
