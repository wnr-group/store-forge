"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeriesPoint } from "./new-orgs-chart";

type Props = { points: SeriesPoint[]; bucket: "day" | "week" | "month"; height?: number; noun?: string };

/** recharts is a large chunk and only renders in the browser, so it loads after the page, with a placeholder of the same height. */
const Impl = dynamic(() => import("./new-orgs-chart").then((m) => m.NewOrgsChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" aria-hidden />,
});

export function NewOrgsChart(props: Props) {
  return (
    <div style={{ height: props.height ?? 240 }}>
      <Impl {...props} />
    </div>
  );
}
