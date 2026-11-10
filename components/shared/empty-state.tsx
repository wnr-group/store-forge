import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string };

export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-14 text-center", className)}>
      <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
