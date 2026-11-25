import { cn } from "@/lib/utils";

type Level = "ok" | "warning" | "reached" | "unknown";

const BAR: Record<Level, string> = { ok: "bg-primary", warning: "bg-warning", reached: "bg-destructive", unknown: "bg-muted-foreground/40" };
const WORD: Record<Level, string> = { ok: "Within limit", warning: "Close to the limit", reached: "Limit reached", unknown: "Not measured" };

/**
 * Usage against a hard limit. The word beside the bar carries the state (colour is never the only signal). With no hard limit there
 * is nothing to fill, so only the number is shown.
 */
export function UsageBar({ used, hard, percent, level, format = (n: number) => n.toLocaleString("en-IN") }: { used: number | null; hard: number | null; percent: number | null; level: Level; format?: (n: number) => string }) {
  if (used === null) return <span className="text-sm text-muted-foreground">Not measured</span>;
  if (hard === null) return <span className="text-sm tabular-nums">{format(used)} <span className="text-muted-foreground">(no limit)</span></span>;
  const width = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <div className="min-w-32 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums">{format(used)} of {format(hard)}</span>
        <span className={cn("tabular-nums", level === "reached" ? "font-medium text-destructive" : level === "warning" ? "text-warning-text" : "text-muted-foreground")}>{percent ?? 0}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-label={WORD[level]}>
        <div className={cn("h-full rounded-full", BAR[level])} style={{ width: `${width}%` }} />
      </div>
      <span className="sr-only">{WORD[level]}</span>
    </div>
  );
}
