import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { ALL_CARD_PARTS, type CardParts } from "@/lib/templates/card-parts";
import { ImagePlaceholder, type CardProduct } from "../../ui";
import { MarketAddButton, MarketHeart } from "./card-actions";
import { Badge, Price, discount } from "./ui";

/**
 * Market product card: a white bordered card with a square picture (sale / sold-out tags top left, heart top right), the
 * name, the price with its struck-through compare-at price and discount, and a full-width orange "Add to cart" button.
 * `layout="list"` is the wide row used by the list view of a listing.
 */
export function MarketProductCard({ product, currency, href, layout = "grid", priority = false, parts = ALL_CARD_PARTS }: { product: CardProduct; currency: string; href?: string | null; tone?: "light" | "dark"; priority?: boolean; layout?: "grid" | "list"; parts?: CardParts }) {
  const img = publicImageUrl(product.image_path);
  const off = discount(product.price_minor, product.compare_at_price_minor);
  const soldOut = product.available === false;
  const list = layout === "list";

  const picture = (
    <div className="relative">
      {href ? (
        <Link href={href} className={cn("relative block aspect-square overflow-hidden bg-white", list && "size-32 rounded-md border border-border/70 sm:size-40")} tabIndex={-1} aria-hidden>
          {img ? <Image src={img} alt="" fill priority={priority} sizes={list ? "160px" : "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"} className={cn("object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none", soldOut && "opacity-60")} /> : <ImagePlaceholder className="absolute inset-0" />}
        </Link>
      ) : (
        <div className={cn("relative aspect-square overflow-hidden bg-white", list && "size-32 rounded-md border border-border/70 sm:size-40")}>{img ? <Image src={img} alt="" fill sizes="200px" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" />}</div>
      )}
      {parts.badge ? (
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
          {soldOut ? <Badge tone="danger">Sold out</Badge> : off ? <Badge tone="accent">Sale</Badge> : null}
        </div>
      ) : null}
      {parts.quickAdd ? <MarketHeart product={product} className={list ? "hidden" : undefined} /> : null}
    </div>
  );

  const title = !parts.title ? null : href ? (
    <Link href={href} className={cn("text-[13px] font-medium leading-snug text-primary transition-colors hover:text-secondary focus-visible:outline-none focus-visible:underline", list ? "text-[15px] font-semibold" : "line-clamp-2 min-h-[34px]")}>
      {product.name}
    </Link>
  ) : (
    <span className="text-[13px] font-medium text-primary">{product.name}</span>
  );

  if (list) {
    return (
      <div data-sf-card="" data-sf-product={product.slug} className="group flex gap-4 rounded-lg border border-border/80 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
        {parts.image ? <div className="shrink-0">{picture}</div> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {title}
          {parts.description && product.short_description ? <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{product.short_description}</p> : null}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
            <Price minor={product.price_minor} compareAt={product.compare_at_price_minor} currency={currency} size="lg" showPrice={parts.price} showCompare={parts.comparePrice} />
            {parts.quickAdd ? (
              <div className="w-full sm:w-40">
                <MarketAddButton product={product} href={href ?? null} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-sf-card="" data-sf-product={product.slug} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      {parts.image ? picture : null}
      <div className="flex flex-1 flex-col p-3">
        {title}
        {parts.description && product.short_description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{product.short_description}</p> : null}
        <Price className={title || parts.description ? "mt-2" : undefined} minor={product.price_minor} compareAt={product.compare_at_price_minor} currency={currency} showPrice={parts.price} showCompare={parts.comparePrice} />
        {parts.quickAdd ? (
          <div className="mt-auto pt-2.5">
            <MarketAddButton product={product} href={href ?? null} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
