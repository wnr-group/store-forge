import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ImageIcon, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the storefront sections, so every theme gets the same responsive grid, spacing and card
 * quality. Sizes follow the theme: the page width and corner radius come from the theme settings (`--sf-page-width`,
 * `--radius`), and every colour comes from the design tokens the theme overrides.
 */

/** Page-width container: fluid gutters on phones, the theme's page width on large screens. */
export const CONTAINER = "mx-auto w-full max-w-[var(--sf-page-width,80rem)] px-4 sm:px-6 lg:px-8";

/** Vertical rhythm of a section: compact on phones, generous on desktop. */
export const SECTION_Y = "py-12 sm:py-16 lg:py-24";

/** Card corners follow the theme radius but stop at 28px, so a pill-shaped button style does not turn big pictures into pillows. */
export const RADIUS = "rounded-[min(var(--radius,0.5rem),28px)]";

/** A setting that holds an image, as a URL the browser can load (theme asset, store file or full URL). */
export function resolveImage(value: unknown): { url: string | null; alt: string } {
  const raw = imageRawPath(value);
  const alt = value && typeof value === "object" && typeof (value as { alt?: unknown }).alt === "string" ? (value as { alt: string }).alt : "";
  if (!raw) return { url: null, alt };
  const url = raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/") ? raw : publicImageUrl(raw);
  return { url, alt };
}

/** Section title row: a responsive heading with an optional intro and a link on the right. */
export function SectionHeading({ title, subtitle, action, align = "left", className }: { title: string; subtitle?: string; action?: React.ReactNode; align?: "left" | "center"; className?: string }) {
  if (!title && !subtitle && !action) return null;
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 sm:mb-10", align === "center" && "flex-col items-center text-center", className)}>
      <div className={cn("min-w-0 max-w-2xl space-y-2", align === "center" && "mx-auto")}>
        {title ? <h2 className="text-2xl leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">{title}</h2> : null}
        {subtitle ? <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * What a picture slot shows before the merchant has chosen an image: a soft panel tinted with the theme's own colour,
 * not a grey box, so a new store still looks designed.
 */
export function ImagePlaceholder({ className, icon = true, deep = false }: { className?: string; icon?: boolean; deep?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: deep ? "linear-gradient(145deg, color-mix(in srgb, var(--tint, var(--primary)) 92%, #000) 0%, color-mix(in srgb, var(--tint, var(--primary)) 66%, #000) 100%)" : "linear-gradient(145deg, color-mix(in srgb, var(--tint, var(--primary)) 16%, var(--background)) 0%, color-mix(in srgb, var(--tint, var(--primary)) 5%, var(--background)) 100%)" }} />
      <div className="absolute -top-1/4 -right-1/5 aspect-square w-3/5 rounded-full" style={{ background: "color-mix(in srgb, var(--tint, var(--primary)) 9%, transparent)" }} />
      <div className="absolute -bottom-1/3 -left-1/5 aspect-square w-3/5 rounded-full" style={{ background: "color-mix(in srgb, var(--tint, var(--primary)) 6%, transparent)" }} />
      {icon ? <ImageIcon className="absolute inset-0 m-auto size-7 text-foreground/20" strokeWidth={1.25} /> : null}
    </div>
  );
}

export type CardProduct = {
  name: string;
  slug: string;
  short_description?: string | null;
  price_minor: number;
  compare_at_price_minor?: number | null;
  image_path?: string | null;
  /** False when the product cannot be bought now. Absent means available (older API). */
  available?: boolean;
};

/** One product in a grid: picture with a sale tag, name and price. Links to the product page when `href` is given. */
export function ProductCard({ product, currency, href, accent, showDescription = false, priority = false }: { product: CardProduct; currency: string; href?: string | null; accent?: string | null; showDescription?: boolean; priority?: boolean }) {
  const img = publicImageUrl(product.image_path);
  const onSale = product.compare_at_price_minor != null && product.compare_at_price_minor > product.price_minor;
  const soldOut = product.available === false;
  const body = (
    <>
      <div className={cn("relative aspect-[4/5] overflow-hidden bg-muted", RADIUS)}>
        {img ? (
          <Image src={img} alt={product.name} fill priority={priority} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className={cn("object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]", soldOut && "opacity-60")} />
        ) : (
          <ImagePlaceholder className="absolute inset-0" />
        )}
        {soldOut ? <span className="absolute top-2 left-2 rounded-[calc(var(--radius,0.5rem)/2)] bg-background px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground shadow-xs">Sold out</span> : onSale ? <span className="absolute top-2 left-2 rounded-[calc(var(--radius,0.5rem)/2)] bg-foreground px-2 py-0.5 text-[11px] font-medium tracking-wide text-background">Sale</span> : null}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium text-foreground sm:text-[15px]">{product.name}</h3>
        {showDescription && product.short_description ? <p className="line-clamp-1 text-xs text-muted-foreground">{product.short_description}</p> : null}
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-foreground" style={accent ? { color: accent } : undefined}>
            {formatMoney(product.price_minor, currency)}
          </span>
          {onSale ? <span className="text-xs text-muted-foreground line-through">{formatMoney(product.compare_at_price_minor!, currency)}</span> : null}
        </p>
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {body}
    </Link>
  ) : (
    <div className="group">{body}</div>
  );
}

/** Picks the column count that fills every row when the products allow it (8 products in "6 columns" become 4), never fewer than 3. */
export function balancedColumns(count: number, columns: number): number {
  if (count <= columns || columns <= 3) return columns;
  for (let c = columns; c >= 3; c--) if (count % c === 0) return c;
  return columns;
}

/** Tailwind column classes for a product/collection grid: two on phones, up to `columns` on desktop. */
export function gridColumns(columns: number): string {
  if (columns <= 2) return "grid-cols-2";
  if (columns === 3) return "grid-cols-2 lg:grid-cols-3";
  if (columns === 5) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  if (columns >= 6) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
  return "grid-cols-2 lg:grid-cols-4";
}

export const GRID_GAP = "gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:gap-x-6";

/**
 * What a product area shows when there is nothing to list. Shoppers see a calm, honest message; the merchant (in the
 * editor and theme preview) also learns how to fill it. Never fake products: an empty catalogue stays empty.
 */
export function EmptyProducts({ mode, title, className }: { mode?: string; title?: string; className?: string }) {
  const merchant = mode === "preview" || mode === "editor";
  return (
    <div className={cn("flex flex-col items-center rounded-[min(var(--radius,0.5rem),28px)] border border-dashed border-border bg-[var(--surface,var(--muted))] px-6 py-14 text-center sm:py-20", className)}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-background text-foreground/60 shadow-xs">
        <ShoppingBag className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="text-lg text-foreground sm:text-xl">{title ?? (merchant ? "No products to show yet" : "New products are on their way")}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {merchant
          ? "Add products in Products and set them to Active: they appear here automatically. Switch to Demo preview to see this theme with sample products."
          : "We are getting things ready. Please check back soon."}
      </p>
    </div>
  );
}

const TONES = [
  { bg: "color-mix(in srgb, var(--primary) 92%, var(--background))", fg: "var(--background)" },
  { bg: "color-mix(in srgb, var(--primary) 10%, var(--background))", fg: "var(--primary)" },
  { bg: "color-mix(in srgb, var(--primary) 26%, var(--background))", fg: "var(--primary)" },
  { bg: "color-mix(in srgb, var(--primary) 68%, var(--background))", fg: "var(--background)" },
];

/** What a collection without a picture shows: a toned panel with a fine inner frame and a large serif initial, so it reads as a designed tile rather than an empty box. */
export function EditorialArt({ name, index, large }: { name: string; index: number; large: boolean }) {
  const tone = TONES[index % TONES.length];
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]" style={{ background: tone.bg, color: tone.fg }}>
      <div className="absolute -top-1/3 -right-1/4 aspect-square w-3/4 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, currentColor 14%, transparent), transparent)" }} />
      <div className="absolute inset-3 border border-current opacity-25 sm:inset-4" />
      <span className={cn("absolute inset-0 flex items-center justify-center leading-none italic opacity-[0.16] select-none", large ? "text-[14rem] sm:text-[18rem]" : "text-[8rem] sm:text-[11rem]")} style={{ fontFamily: "var(--sf-font-heading, serif)", fontWeight: 400 }}>
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-3 text-[0.65rem] tracking-[0.3em] uppercase opacity-70 sm:bottom-8">
        <span className="h-px w-6 bg-current" />
        Explore
        <span className="h-px w-6 bg-current" />
      </span>
    </div>
  );
}

/** Header of an editorial section: a small tracked label, a large serif title, a hairline and a "View all" link. */
export function EditorialHeader({ eyebrow, title, href, linkLabel = "View all" }: { eyebrow: string; title: string; href?: string | null; linkLabel?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-5 sm:mb-12 sm:pb-6">
      <div className="min-w-0 space-y-2">
        <p className="text-[0.7rem] tracking-[0.28em] text-muted-foreground uppercase">{eyebrow}</p>
        {title ? <h2 className="text-3xl leading-[1.05] tracking-tight text-foreground sm:text-4xl lg:text-5xl">{title}</h2> : null}
      </div>
      {href ? (
        <Link href={href} className="group/all inline-flex shrink-0 items-center gap-2 border-b border-foreground/0 pb-0.5 text-sm text-foreground transition-colors hover:border-foreground">
          {linkLabel}
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5" strokeWidth={1.5} />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Product card for editorial themes: tall picture with a square tag and index, a "View piece" bar that slides up on
 * hover, and the name in serif above a fine-tracked price. Corners follow the theme.
 */
export function EditorialProductCard({ product, currency, href, index, priority = false }: { product: CardProduct; currency: string; href: string; index: number; priority?: boolean }) {
  const img = publicImageUrl(product.image_path);
  const onSale = product.compare_at_price_minor != null && product.compare_at_price_minor > product.price_minor;
  const soldOut = product.available === false;
  return (
    <Link href={href} className="group flex flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
      <div className={cn("relative aspect-[3/4] w-full overflow-hidden bg-muted", RADIUS)}>
        {img ? <Image src={img} alt={product.name} fill priority={priority} sizes="(min-width: 1024px) 25vw, 50vw" className={cn("object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]", soldOut && "opacity-60")} /> : <ProductPlaceholder index={index} />}
        <span aria-hidden className="absolute top-3 left-3 text-[0.65rem] tracking-[0.2em] text-white mix-blend-difference sm:top-4 sm:left-4">{String(index + 1).padStart(2, "0")}</span>
        {soldOut || onSale ? <span className="absolute top-3 right-3 bg-background px-2.5 py-1 text-[0.6rem] tracking-[0.2em] text-foreground uppercase sm:top-4 sm:right-4">{soldOut ? "Sold out" : "Sale"}</span> : null}
        <span aria-hidden className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-background/95 py-3.5 text-[0.65rem] tracking-[0.26em] text-foreground uppercase backdrop-blur-sm transition-transform duration-500 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0">
          View piece <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
        </span>
      </div>
      <div className="space-y-1.5">
        <h3 className="truncate text-lg leading-snug tracking-tight text-foreground sm:text-xl">{product.name}</h3>
        <p className="flex flex-wrap items-baseline gap-x-3 text-sm tracking-[0.06em]">
          <span className="text-foreground">{formatMoney(product.price_minor, currency)}</span>
          {onSale ? <span className="text-xs text-muted-foreground line-through">{formatMoney(product.compare_at_price_minor!, currency)}</span> : null}
        </p>
      </div>
    </Link>
  );
}

const PLACEHOLDER_WALLS = ["#e9e2d6", "#d9cfbf", "#cdbfa9", "#e2d6c5"];
const PLACEHOLDER_GARMENTS = ["#2b2622", "#9a3412", "#f4efe6", "#6b6258"];

/** A studio-style stand-in for a product photo: a warm wall, a floor shadow and a hanging garment, until the merchant adds the real picture. */
function ProductPlaceholder({ index }: { index: number }) {
  const wall = PLACEHOLDER_WALLS[index % PLACEHOLDER_WALLS.length];
  const garment = PLACEHOLDER_GARMENTS[(index + 1) % PLACEHOLDER_GARMENTS.length];
  return (
    <svg aria-hidden viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]">
      <defs>
        <linearGradient id={`pw${index}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill={wall} />
      <rect width="300" height="400" fill={`url(#pw${index})`} />
      <ellipse cx="150" cy="352" rx="82" ry="9" fill="#000" opacity=".14" />
      <path d="M150 74c0-9 9-12 9-21a9 9 0 1 0-18 0" fill="none" stroke="#8a8175" strokeWidth="3" strokeLinecap="round" />
      <path d="M150 74 62 118h176z" fill="none" stroke="#8a8175" strokeWidth="3" strokeLinejoin="round" />
      <path d="M112 106 68 128l20 38 22-11v146h80V155l22 11 20-38-44-22q-38 26-76 0z" fill={garment} />
      <path d="M112 106q38 26 76 0" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="2" />
    </svg>
  );
}

/**
 * Grocery product card: a white card with the picture on a soft panel, a real discount badge (worked out from the compare-at
 * price, never invented), the name, price and an arrow chip. The hover lift and shadow animate on their own layers so they stay smooth.
 */
export function GroceryProductCard({ product, currency, href, priority = false }: { product: CardProduct; currency: string; href?: string | null; priority?: boolean }) {
  const img = publicImageUrl(product.image_path);
  const compare = product.compare_at_price_minor;
  const onSale = compare != null && compare > product.price_minor;
  const off = onSale ? Math.max(1, Math.round((1 - product.price_minor / compare!) * 100)) : 0;
  const soldOut = product.available === false;
  const cardClass = "group relative isolate flex h-full transform-gpu flex-col rounded-3xl bg-background p-2.5 outline-none ring-1 ring-border transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  const body = (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-0 shadow-[0_22px_34px_-18px_rgba(20,35,26,0.4)] transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
      <span className="relative isolate block aspect-square w-full transform-gpu overflow-hidden rounded-2xl bg-muted">
        {img ? (
          <Image src={img} alt="" fill priority={priority} sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 46vw" className={cn("object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.07] motion-reduce:transition-none", soldOut && "opacity-60")} />
        ) : (
          <ImagePlaceholder className="absolute inset-0" />
        )}
        {soldOut ? (
          <span className="absolute left-2 top-2 rounded-full bg-background px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm">Sold out</span>
        ) : onSale ? (
          <span className="absolute left-2 top-2 rounded-full bg-[color-mix(in_srgb,var(--accent,#ea580c)_82%,black)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">{off}% off</span>
        ) : null}
      </span>
      <span className="mt-3 flex flex-1 flex-col px-1 pb-1">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{product.name}</span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="flex min-w-0 flex-col leading-tight">
            {onSale ? <span className="text-xs text-muted-foreground line-through">{formatMoney(compare!, currency)}</span> : null}
            <span className="text-base font-extrabold text-foreground">{formatMoney(product.price_minor, currency)}</span>
          </span>
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
          </span>
        </span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={cardClass}>
      {body}
    </Link>
  ) : (
    <div className={cardClass}>{body}</div>
  );
}
