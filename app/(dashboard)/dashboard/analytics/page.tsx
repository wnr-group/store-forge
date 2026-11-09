import type { Metadata } from "next";
import { AnalyticsView, RangeTabs } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getAnalytics, RANGES, type RangeDays } from "@/services/analytics.service";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).range;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  const range = (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
  const { store } = await requireWorkspaceCan("orders:view");
  const data = await getAnalytics(range, store?.timezone ?? "UTC");

  return (
    <>
      <PageHeader title="Analytics" description={`Sales and orders in ${store?.currency ?? "your currency"}, by day in ${store?.timezone ?? "UTC"}.`} actions={<RangeTabs range={range} basePath={ROUTES.analytics} />} />
      <AnalyticsView data={data} currency={store?.currency ?? "INR"} detailed />
    </>
  );
}
