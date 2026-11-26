"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SeriesPoint = { start: string; created: number };

const fmt = {
  day: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
  week: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
  month: new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }),
} as const;

type Props = { points: SeriesPoint[]; bucket: "day" | "week" | "month"; height?: number; /** What is being counted, singular: "organization" (default) or "subscription". */ noun?: string };

/** New organizations per day, week or month. The server zero-fills the series, so a gap is a real zero. */
export function NewOrgsChart({ points, bucket, height = 240, noun = "organization" }: Props) {
  const rows = points.map((p) => ({ ...p, label: fmt[bucket].format(new Date(`${p.start}T00:00:00Z`)) }));
  const total = rows.reduce((s, r) => s + r.created, 0);
  const unit = bucket === "week" ? "week" : bucket === "month" ? "month" : "day";
  const axis = { stroke: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-geist-mono)", tickLine: false, axisLine: false } as const;

  return (
    <div role="img" aria-label={`New ${noun}s per ${unit}: ${total} in total over ${rows.length} ${unit}s.`} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={28} />
          <YAxis {...axis} width={28} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof rows)[number];
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{bucket === "week" ? `Week of ${p.label}` : p.label}</p>
                  <p className="tabular-nums text-muted-foreground">
                    {p.created} new {noun}{p.created === 1 ? "" : "s"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="created" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
