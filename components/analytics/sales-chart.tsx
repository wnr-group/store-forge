"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

export type Point = { day: string; salesMinor: number; orders: number };

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const label = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));

type Props = { data: Point[]; currency: string; metric: "sales" | "orders"; height?: number };

/** Daily sales (area) or orders (bars). Data is already zero-filled by the server, so gaps are real zeros. */
export function SalesChart({ data, currency, metric, height = 260 }: Props) {
  const rows = data.map((p) => ({ ...p, label: label(p.day), value: metric === "sales" ? p.salesMinor : p.orders }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  const summary = `${metric === "sales" ? "Daily sales" : "Daily orders"} over ${rows.length} days, ${metric === "sales" ? formatMoney(total, currency) : total} in total.`;
  const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
  const tooltip = (
    <Tooltip
      cursor={{ stroke: "var(--border)" }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload as (typeof rows)[number];
        return (
          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
            <p className="font-medium">{p.label}</p>
            <p className="tabular-nums text-muted-foreground">{formatMoney(p.salesMinor, currency)} · {p.orders} order{p.orders === 1 ? "" : "s"}</p>
          </div>
        );
      }}
    />
  );

  return (
    <div role="img" aria-label={summary} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {metric === "sales" ? (
          <AreaChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sf-sales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={28} />
            <YAxis {...axis} width={52} tickFormatter={(v: number) => formatMoneyCompact(v, currency)} />
            {tooltip}
            <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#sf-sales)" isAnimationActive={false} />
          </AreaChart>
        ) : (
          <BarChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={28} />
            <YAxis {...axis} width={32} allowDecimals={false} />
            {tooltip}
            <Bar dataKey="value" fill="var(--chart-2)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
