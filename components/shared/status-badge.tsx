import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES = {
  active: "bg-success/12 text-success-text border-success/25",
  draft: "bg-muted text-muted-foreground border-transparent",
  warning: "bg-warning/15 text-warning-text border-warning/35",
  danger: "bg-error/10 text-destructive border-error/30",
  info: "bg-info/10 text-info-text border-info/30",
  neutral: "bg-secondary text-secondary-foreground border-transparent",
} as const;

export type Tone = keyof typeof TONES;

/** Status pill. Colour is never the only signal: the label always states the status. */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-5 gap-1.5 rounded-full px-2 text-[11px] font-medium", TONES[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </Badge>
  );
}
