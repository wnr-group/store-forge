import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One headline number. `hint` carries the unit or the explanation; a missing figure is passed as "—", never as 0. */
export function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: React.ReactNode; hint?: string; icon?: LucideIcon; tone?: "warning" | "danger" }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("truncate text-2xl font-semibold tabular-nums", tone === "warning" && "text-warning-text", tone === "danger" && "text-destructive")}>{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? <Icon className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </CardContent>
    </Card>
  );
}
