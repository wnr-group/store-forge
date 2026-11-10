import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Actions rendered in a footer strip of the card (e.g. the save button). */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Settings layout: the section's title and explanation on the left, its fields in a bordered panel on the right
 * (stacked on small screens). Keeps long settings pages scannable and every section aligned to the same grid.
 */
export function SettingsSection({ title, description, children, footer, className }: Props) {
  return (
    <section className={cn("grid gap-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10", className)}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
        <div className="space-y-4 p-5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3">{footer}</div> : null}
      </div>
    </section>
  );
}
