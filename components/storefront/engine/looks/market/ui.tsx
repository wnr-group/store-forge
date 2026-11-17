import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatBagPrice } from "@/lib/cart/format";
import { cn } from "@/lib/utils";

/**
 * Building blocks of the Market look (the "Marketplace" theme): a dense, shop-first layout on a light grey page. White
 * bordered panels, small corners, a dark header and footer, a teal primary action and an orange "buy" action.
 * Colours come from the theme: primary = the dark ink, secondary = the teal, accent = the orange.
 */

/** Page-width container, narrower gutters than the other looks (it is a dense layout). */
export const WRAP = "mx-auto w-full max-w-[var(--sf-page-width,97.5rem)] px-3 sm:px-4 lg:px-5";

/** A white, bordered, softly raised surface. */
export const PANEL = "rounded-xl border border-border/80 bg-white shadow-sm";

export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary";

const BTN = "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const SIZE = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-11 px-5 text-[15px] rounded-lg" };
/** The orange "buy" button. */
export const btnAccent = (size: keyof typeof SIZE = "md") => cn(BTN, SIZE[size], "border-black/10 bg-accent text-accent-foreground shadow-sm hover:brightness-95", FOCUS);
/** The teal primary button. */
export const btnPrimary = (size: keyof typeof SIZE = "md") => cn(BTN, SIZE[size], "border-black/10 bg-secondary text-secondary-foreground shadow-sm hover:brightness-110", FOCUS);
/** The white outlined button. */
export const btnOutline = (size: keyof typeof SIZE = "md") => cn(BTN, SIZE[size], "border-border bg-white text-foreground shadow-sm hover:bg-muted", FOCUS);

const TONES = {
  accent: "border-accent/30 bg-accent/10 text-[color-mix(in_srgb,var(--accent)_70%,#000)]",
  brand: "border-secondary/25 bg-secondary/10 text-secondary",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-border bg-muted text-foreground/80",
} as const;

/** A small tag: "Sale", "Sold out", "Only 3 left". */
export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4", TONES[tone], className)}>{children}</span>;
}

/** The discount in whole percent when `compareAt` is above `price`. */
export function discount(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

const MAIN = { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-3xl" } as const;
const SUB = { sm: "text-[11px]", md: "text-xs", lg: "text-sm", xl: "text-base" } as const;

/** Price, the struck-through compare-at price and the discount in green. */
export function Price({ minor, compareAt, currency, size = "md", className }: { minor: number; compareAt?: number | null; currency: string; size?: keyof typeof MAIN; className?: string }) {
  const off = discount(minor, compareAt);
  return (
    <span className={cn("flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5", className)}>
      <span className={cn("font-semibold tracking-tight tabular-nums text-primary", MAIN[size])}>{formatBagPrice(minor, currency)}</span>
      {off > 0 ? (
        <>
          <span className={cn("text-muted-foreground line-through tabular-nums", SUB[size])}>{formatBagPrice(compareAt!, currency)}</span>
          <span className={cn("font-semibold text-emerald-700 tabular-nums", SUB[size])}>{off}% off</span>
        </>
      ) : null}
    </span>
  );
}

/** A section header row on a panel: a bold title, an optional line under it and a "See all" link. */
export function PanelHeader({ title, subtitle, href, linkLabel = "See all →", leading, trailing }: { title: string; subtitle?: string; href?: string | null; linkLabel?: string; leading?: React.ReactNode; trailing?: React.ReactNode }) {
  if (!title && !href) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-primary">
            {leading}
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {trailing}
      </div>
      {href ? (
        <Link href={href} className="whitespace-nowrap text-[13px] font-semibold text-secondary hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden /> : null}
            {it.href ? (
              <Link href={it.href} className="hover:text-secondary hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-primary">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The store's mark: an orange rounded square with its first letter, then its name. */
export function Logo({ name, dark = true }: { name: string; dark?: boolean }) {
  return (
    <span className="inline-flex select-none items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[15px] font-bold text-accent-foreground shadow-sm">{name.trim().slice(0, 1).toUpperCase() || "S"}</span>
      <span className={cn("max-w-[11rem] truncate font-extrabold tracking-tight text-[17px]", dark ? "text-primary-foreground" : "text-primary")} style={{ fontFamily: "var(--sf-font-heading)" }}>
        {name}
      </span>
    </span>
  );
}

/** Colours for the initial squares that stand in for a collection with no picture. */
export const TILE_COLOURS = ["#106762", "#c72d0c", "#414b5e", "#12817a", "#9e2612", "#505c74", "#11534f", "#f03e0b"];
