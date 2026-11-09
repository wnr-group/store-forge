import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Building blocks for page-specific loading states. Each one copies the chrome and breakpoints of the real component it stands
 * in for (PageHeader, ListFilters, Table, SectionCard, Pagination, ...), so a page's loading screen has the same shape as the page
 * and nothing jumps when the data arrives. Compose them in a route's loading.tsx to mirror that page's layout.
 */

/** Wraps a whole loading screen: announced once to assistive technology as "Loading". */
export function LoadingShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={className}>
      {children}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Same spacing as PageHeader: title, description, and optional action buttons on the right. */
export function SkeletonHeader({ actions = 0, description = true }: { actions?: number; description?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-7 w-44 sm:h-8" />
        {description ? <Skeleton className="h-4 w-72 max-w-full" /> : null}
      </div>
      {actions > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Same row as ListFilters: search box, filter selects, date pickers, and a sort select at the far right. */
export function SkeletonToolbar({ search = true, selects = 0, dates = 0, sort = false }: { search?: boolean; selects?: number; dates?: number; sort?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {search ? <Skeleton className="h-9 min-w-52 flex-1 sm:max-w-xs" /> : null}
      {Array.from({ length: selects }, (_, i) => (
        <Skeleton key={`s${i}`} className="h-9 w-36" />
      ))}
      {Array.from({ length: dates }, (_, i) => (
        <Skeleton key={`d${i}`} className="h-9 w-40" />
      ))}
      {sort ? <Skeleton className="h-9 w-36 sm:ml-auto" /> : null}
    </div>
  );
}

export type SkeletonColumn = {
  /** What the cell holds. */
  kind?: "text" | "two-line" | "media" | "badge" | "check" | "actions";
  /** Width of the bar (a Tailwind width class). */
  w?: string;
  align?: "right";
  /** Hidden below this breakpoint, exactly like the real column. */
  hide?: "sm" | "md" | "lg" | "xl";
};

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
const WIDTHS = ["w-28", "w-36", "w-24", "w-32", "w-20"];

function Cell({ col, row }: { col: SkeletonColumn; row: number }) {
  const w = col.w ?? WIDTHS[row % WIDTHS.length];
  const right = col.align === "right" ? "ml-auto" : "";
  switch (col.kind) {
    case "check":
      return <Skeleton className="size-4 rounded" />;
    case "actions":
      return <Skeleton className="ml-auto size-7" />;
    case "badge":
      return <Skeleton className={cn("h-5 w-16 rounded-md", right)} />;
    case "two-line":
      return (
        <div className={cn("space-y-1.5", right && "flex flex-col items-end")}>
          <Skeleton className={cn("h-4", w)} />
          <Skeleton className="h-3 w-24" />
        </div>
      );
    case "media":
      return (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className={cn("h-4", w)} />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      );
    default:
      return <Skeleton className={cn("h-4", w, right)} />;
  }
}

/**
 * A table with the same header row, column order, alignment and responsive columns as the real one.
 * `className` goes on the wrapper, e.g. "hidden md:block" for a table that has a mobile card list instead.
 */
export function SkeletonTable({ columns, rows = 8, className }: { columns: SkeletonColumn[]; rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {columns.map((c, i) => (
              <th key={i} className={cn("h-9 px-3 text-left align-middle", c.hide && HIDE[c.hide], c.kind === "check" && "w-10", c.kind === "actions" && "w-10")}>
                {c.kind === "check" || c.kind === "actions" ? null : <Skeleton className={cn("h-3 w-16", c.align === "right" && "ml-auto")} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b last:border-b-0">
              {columns.map((c, i) => (
                <td key={i} className={cn("px-3 py-2.5 align-middle", c.hide && HIDE[c.hide])}>
                  <Cell col={c} row={r} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The mobile card list that replaces a table below the `md` breakpoint (products). */
export function SkeletonCardList({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <ul className={cn("space-y-2 md:hidden", className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
          <Skeleton className="mt-1 size-4 rounded" />
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Same as Pagination: "1–20 of N" on the left, rows-per-page (optional) and previous / next on the right. */
export function SkeletonPagination({ pageSize = false }: { pageSize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <Skeleton className="h-4 w-20" />
      <div className="flex items-center gap-3">
        {pageSize ? <Skeleton className="hidden h-9 w-32 sm:block" /> : null}
        <div className="flex items-center gap-1">
          <Skeleton className="size-8" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="size-8" />
        </div>
      </div>
    </div>
  );
}

/** A row of metric tiles. `icon` matches the admin tiles, which have an icon on the right. */
export function SkeletonStats({ count = 4, className, icon = false }: { count?: number; className?: string; icon?: boolean }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn("rounded-lg border bg-card p-4", icon && "flex items-start justify-between gap-3")}>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-28" />
            {icon ? null : <Skeleton className="h-3 w-24" />}
          </div>
          {icon ? <Skeleton className="size-5" /> : null}
        </div>
      ))}
    </div>
  );
}

/** Same card as SectionCard: a title (and optional description / action) over its content. */
export function SkeletonSection({
  children,
  description = false,
  action = false,
  className,
}: {
  children?: React.ReactNode;
  description?: boolean;
  action?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          {description ? <Skeleton className="h-3.5 w-64 max-w-full" /> : null}
        </div>
        {action ? <Skeleton className="h-8 w-20" /> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** A chart area of the given height. */
export function SkeletonChart({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

/** A divided list: a name and a detail on the left, a value on the right (best sellers, recent orders, low stock...). */
export function SkeletonRows({ rows = 5, badge = false }: { rows?: number; badge?: boolean }) {
  return (
    <ul className="divide-y">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-6 shrink-0" />
            <span className="space-y-1.5">
              <Skeleton className={cn("h-4", WIDTHS[i % WIDTHS.length])} />
            </span>
          </span>
          {badge ? <Skeleton className="h-5 w-16 rounded-md" /> : <Skeleton className="h-4 w-14" />}
        </li>
      ))}
    </ul>
  );
}

/** One labelled input. */
export function SkeletonField({ label = "w-24", height = "h-9" }: { label?: string; height?: string }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className={cn("h-3.5", label)} />
      <Skeleton className={cn("w-full", height)} />
    </div>
  );
}

/** A grid of labelled inputs: `cols` per row from the `sm` breakpoint up. */
export function SkeletonFields({ count = 2, cols = 2 }: { count?: number; cols?: 1 | 2 | 3 }) {
  return (
    <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonField key={i} label={WIDTHS[i % WIDTHS.length]} />
      ))}
    </div>
  );
}

/** The two-column editor layout used by product and collection forms: main sections left, a narrow column right. */
export function SkeletonEditorLayout({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">{main}</div>
      <div className="space-y-4">{side}</div>
    </div>
  );
}

/** The sticky Save / Cancel bar at the bottom of the editor forms. */
export function SkeletonActionBar() {
  return (
    <div className="sticky bottom-0 z-20 -mx-3 mt-6 border-t bg-background sm:-mx-6">
      <div className="flex items-center justify-end gap-2 px-3 py-3 sm:px-6">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

/** A settings block: title and explanation on the left, a bordered panel of fields on the right (SettingsSection). */
export function SkeletonSettingsSection({ fields = 2, cols = 1, footer = true }: { fields?: number; cols?: 1 | 2; footer?: boolean }) {
  return (
    <section className="grid gap-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
        <div className="p-5">
          <SkeletonFields count={fields} cols={cols} />
        </div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3">
            <Skeleton className="h-8 w-24" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
