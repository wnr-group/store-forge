import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/app";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { canViewOrders } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { getAnalytics } from "@/services/analytics.service";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const { active, store } = await requireWorkspace();
  if (!store) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No store yet</CardTitle>
          <CardDescription>This workspace does not have a store.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const showAnalytics = canViewOrders(active);
  const data = showAnalytics ? await getAnalytics(30) : null;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const storeUrl = storefrontUrl(store.slug, root, active.tenant.publicId);

  return (
    <>
      <PageHeader
        title={store.name}
        description={
          storeUrl ? (
            <>
              {active.tenant.name} ·{" "}
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                {storefrontHost(store.slug, root, active.tenant.publicId)}
              </a>
            </>
          ) : (
            active.tenant.name
          )
        }
        actions={
          <>
            <StatusBadge tone={store.status === "active" ? "active" : "draft"}><span className="capitalize">{store.status}</span></StatusBadge>
            {showAnalytics ? (
              <Link href={ROUTES.analytics} className={buttonVariants({ variant: "outline" })}>
                <BarChart3 aria-hidden /> Analytics
              </Link>
            ) : null}
          </>
        }
      />
      {data ? <AnalyticsView data={data} currency={store.currency} timezone={store.timezone} /> : null}
    </>
  );
}
