"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { data: { day: string; salesMinor: number; orders: number }[]; currency: string; metric: "sales" | "orders"; height?: number };

/**
 * The chart pulls in recharts (~400 KB of JS). It only renders in the browser anyway (its container measures the DOM),
 * so it is loaded as a separate chunk after the page's own content instead of blocking it. The placeholder has the
 * chart's exact height, so nothing shifts when it arrives.
 */
const SalesChartImpl = dynamic(() => import("./sales-chart").then((m) => m.SalesChart), {
  ssr: false,
  loading: () => <ChartPlaceholder />,
});

function ChartPlaceholder() {
  return <Skeleton className="h-full w-full" aria-hidden />;
}

export function SalesChart(props: Props) {
  return (
    <div style={{ height: props.height ?? 260 }}>
      <SalesChartImpl {...props} />
    </div>
  );
}
