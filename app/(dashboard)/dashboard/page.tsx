import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/app";
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
  const data = await getAnalytics(30, store.timezone);

  return (
    <>
      <PageHeader
        title={store.name}
        description={`${active.tenant.name} · ${store.slug}.storeforge.app`}
        actions={
          <>
            <StatusBadge tone={store.status === "active" ? "active" : "draft"}><span className="capitalize">{store.status}</span></StatusBadge>
            <Link href={ROUTES.analytics} className={buttonVariants({ variant: "outline" })}>
              Analytics <ExternalLink className="opacity-60" aria-hidden />
            </Link>
          </>
        }
      />
      <AnalyticsView data={data} currency={store.currency} />
    </>
  );
}
