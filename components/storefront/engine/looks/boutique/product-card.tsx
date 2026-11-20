import Image from "next/image";
import Link from "next/link";
import { formatBagPrice } from "@/lib/cart/format";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { ALL_CARD_PARTS, type CardParts } from "@/lib/templates/card-parts";
import { ImagePlaceholder, type CardProduct } from "../../ui";
import { CardActions } from "./card-actions";

/** Whole-number discount for a compare-at price, or null when the product is not reduced. */
export function percentOff(price: number, compareAt?: number | null): number | null {
  if (compareAt == null || compareAt <= price || compareAt <= 0) return null;
  const pct = Math.round(((compareAt - price) / compareAt) * 100);
  return pct > 0 ? pct : null;
}

const BADGE = "absolute left-3 top-3 bg-background/95 px-2 py-1 text-[9px] font-medium uppercase leading-none tracking-[0.18em] text-foreground";

/**
 * Boutique product card: a 3:4 picture with square corners and a hairline border, a small badge, the name in the display
 * face, then price, struck compare-at price and the percentage off. `tone="dark"` is the same card on the primary colour.
 */
export function BoutiqueProductCard({ product, currency, href, tone = "light", priority = false, parts = ALL_CARD_PARTS }: { product: CardProduct; currency: string; href?: string | null; tone?: "light" | "dark"; priority?: boolean; parts?: CardParts }) {
  const img = publicImageUrl(product.image_path);
  const off = percentOff(product.price_minor, product.compare_at_price_minor);
  const soldOut = product.available === false;
  const dark = tone === "dark";
  const body = (
    <>
      {parts.image ? (
      <div className={cn("relative aspect-[3/4] overflow-hidden border", dark ? "border-white/15 bg-white/5" : "border-border bg-muted")}>
        {img ? (
          <Image src={img} alt={product.name} fill priority={priority} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className={cn("object-cover transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none", soldOut && "opacity-60")} />
        ) : (
          <ImagePlaceholder className="absolute inset-0" />
        )}
        {parts.badge ? (soldOut ? <span className={BADGE}>Sold out</span> : off ? <span className={BADGE}>Reduced</span> : null) : null}
      </div>
      ) : null}
      <div className={cn("space-y-1", parts.image && "mt-3")}>
        {parts.title ? (
          <h3 className={cn("line-clamp-2 text-lg leading-[1.1] tracking-[-0.01em]", dark ? "text-white" : "text-foreground")} style={{ fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" }}>
            {product.name}
          </h3>
        ) : null}
        {parts.description && product.short_description ? <p className={cn("line-clamp-1 text-[13px]", dark ? "text-white/65" : "text-muted-foreground")}>{product.short_description}</p> : null}
        {parts.price || (parts.comparePrice && off) ? (
          <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            {parts.price ? <span className={dark ? "text-white" : "text-foreground"}>{formatBagPrice(product.price_minor, currency)}</span> : null}
            {parts.comparePrice && off ? (
              <>
                <span className={cn("line-through", dark ? "text-white/55" : "text-muted-foreground")}>{formatBagPrice(product.compare_at_price_minor!, currency)}</span>
                <span className={dark ? "text-accent" : "text-primary"}>{off}% off</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </>
  );
  const focus = dark ? "focus-visible:outline-white" : "focus-visible:outline-primary";
  return (
    <div className="group relative" data-sf-card="" data-sf-product={product.slug}>
      {href ? (
        <Link href={href} className={cn("block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4", focus)}>
          {body}
        </Link>
      ) : (
        body
      )}
      {parts.quickAdd && parts.image ? <CardActions product={product} href={href ?? null} /> : null}
    </div>
  );
}
