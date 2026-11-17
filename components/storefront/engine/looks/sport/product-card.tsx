import Image from "next/image";
import Link from "next/link";
import { formatBagPrice } from "@/lib/cart/format";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { ImagePlaceholder, type CardProduct } from "../../ui";
import { CardActions } from "../boutique/card-actions";
import { percentOff } from "../boutique/product-card";

const BADGE = "absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-secondary shadow-sm";

/**
 * Sport product card: a rounded 4:5 picture, a small pill badge, the name, two lines of description and the price with its
 * discount chip. The heart and the hover "Add to bag" bar sit over the picture, outside the link.
 */
export function SportProductCard({ product, currency, href, tone = "light", priority = false }: { product: CardProduct; currency: string; href?: string | null; tone?: "light" | "dark"; priority?: boolean }) {
  const img = publicImageUrl(product.image_path);
  const off = percentOff(product.price_minor, product.compare_at_price_minor);
  const soldOut = product.available === false;
  const dark = tone === "dark";
  const body = (
    <>
      <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[1.25rem] border", dark ? "border-white/10 bg-white/5" : "border-border/70 bg-[var(--surface)]")}>
        {img ? <Image src={img} alt={product.name} fill priority={priority} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className={cn("object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none", soldOut && "opacity-60")} /> : <ImagePlaceholder className="absolute inset-0" />}
        {soldOut ? <span className={BADGE}>Sold out</span> : off ? <span className={cn(BADGE, "bg-accent text-primary")}>Sale</span> : null}
      </div>
      <div className="mt-3.5 space-y-1 px-1">
        <h3 className={cn("line-clamp-2 text-[16px] font-semibold leading-snug", dark ? "text-white" : "text-primary")}>{product.name}</h3>
        {product.short_description ? <p className={cn("line-clamp-2 text-[12.5px] leading-relaxed", dark ? "text-white/65" : "text-muted-foreground")}>{product.short_description}</p> : null}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <span className={cn("text-[17px] font-bold", dark ? "text-white" : "text-primary")}>{formatBagPrice(product.price_minor, currency)}</span>
          {off ? (
            <>
              <span className={cn("text-[13px] line-through", dark ? "text-white/50" : "text-muted-foreground")}>{formatBagPrice(product.compare_at_price_minor!, currency)}</span>
              <span className="rounded-full bg-[#e3f4ea] px-2 py-0.5 text-[11px] font-semibold text-[#1c7a42]">{off}% off</span>
            </>
          ) : null}
        </p>
      </div>
    </>
  );
  return (
    <div className="group relative">
      {href ? (
        <Link href={href} className={cn("block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4", dark ? "focus-visible:outline-white" : "focus-visible:outline-primary")}>
          {body}
        </Link>
      ) : (
        body
      )}
      <CardActions product={product} href={href ?? null} aspect="aspect-[4/5]" inset="inset-x-3 bottom-3" round="rounded-full" />
    </div>
  );
}
