import Image from "next/image";
import Link from "next/link";
import { ImageIcon, ShoppingBag } from "lucide-react";
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
