import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, SearchX, Tags } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { money } from "@/lib/admin/format";
import { requirePlatformPagePermission, getPlatformAccess } from "@/lib/auth/platform";
import { ADMIN_PAGE_SIZES } from "@/lib/validations/admin-list";
import { planListQuerySchema } from "@/lib/validations/admin-commercial";
import { listPlans } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Subscription plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("plans:read");
  const raw = await searchParams;
  const query = planListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [{ items: plans, meta }, access] = await Promise.all([
    listPlans({ search: query.q, status: query.status, page: query.page, limit: query.pageSize }),
    getPlatformAccess(),
  ]);
  const canManage = access?.permissions.includes("plans:manage") ?? false;
  const filtered = Boolean(query.q) || query.status !== "all";
  const create = canManage ? (
    <Link href={`${ROUTES.adminPlans}/new`} className={buttonVariants()}>
      <PlusCircle aria-hidden /> Create plan
    </Link>
  ) : null;

  return (
    <>
      <PageHeader title="Subscription plans" description="What each plan costs, includes and limits. Organizations get the features and limits of the plan they are on, straight away." actions={create} />
      {meta.total === 0 && !filtered ? (
        <EmptyState icon={Tags} title="No plans yet" description="Create a plan to give organizations features and limits." action={create ?? undefined} />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search by name or code"
            filters={[{ key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }]}
          />
          {meta.total === 0 ? (
            <EmptyState icon={SearchX} title="No plans match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Monthly</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Yearly</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Trial</TableHead>
                      <TableHead className="text-right">Organizations</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link href={`${ROUTES.adminPlans}/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                          <span className="block text-xs text-muted-foreground">
                            {p.code}
                            {p.isDefault ? " · default for new organizations" : ""}
                            {p.isUnrestricted ? " · unrestricted" : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.monthlyPriceMinor === 0 ? "Free" : money(p.monthlyPriceMinor, p.currency)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.yearlyPriceMinor === 0 ? "Free" : money(p.yearlyPriceMinor, p.currency)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{p.trialDays === 0 ? "None" : `${p.trialDays} days`}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.subscriberCount}</TableCell>
                        <TableCell>
                          <StatusBadge tone={p.status === "active" ? "active" : "draft"}>{p.status === "active" ? "Active" : "Inactive"}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={meta.page} pageSize={meta.limit} total={meta.total} basePath={ROUTES.adminPlans} params={{ q: query.q, status: query.status, pageSize: String(meta.limit) }} pageSizeOptions={ADMIN_PAGE_SIZES} />
            </>
          )}
        </>
      )}
    </>
  );
}
