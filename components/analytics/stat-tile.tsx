import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { changeLabel } from "@/lib/marketing/labels";
import { cn } from "@/lib/utils";

/**
 * One figure with a label, an optional line of explanation and, when given, the change since the previous period. The change is
 * words and an arrow as well as a colour. `change: undefined` shows none; `null` says there is no earlier period to compare to.
 */
export function StatTile({ label, value, hint, change, className }: { label: string; value: string; hint?: string; change?: number | null; className?: string }) {
  const c = change === undefined ? null : changeLabel(change);
  return (
    <Card className={cn("gap-1 px-4 py-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {c ? (
        <p className={cn("flex items-center gap-1 text-xs", c.tone === "up" && "text-success-text", c.tone === "down" && "text-destructive", (c.tone === "flat" || c.tone === "none") && "text-muted-foreground")}>
          {c.tone === "up" ? <ArrowUpRight className="size-3.5" aria-hidden /> : c.tone === "down" ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
          <span>{c.text}</span>
          {c.tone === "up" || c.tone === "down" ? <span className="text-muted-foreground">vs the period before</span> : null}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
