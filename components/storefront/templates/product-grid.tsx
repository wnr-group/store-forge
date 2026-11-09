import Image from "next/image";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";
import type { StorefrontData } from "@/lib/templates/types";

/** Shared by every template: the product list, with the accent applied only to the price color when set. */
export function ProductGrid({ store, accent }: { store: StorefrontData; accent: string | null }) {
  const priceStyle = accent ? { color: accent } : undefined;
  if (store.products.length === 0) {
    return <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">Products are coming soon.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {store.products.map((p) => {
        const img = publicImageUrl(p.image_path);
        const onSale = p.compare_at_price_minor !== null && p.compare_at_price_minor > p.price_minor;
        return (
          <li key={p.slug} className="overflow-hidden rounded-xl border bg-card">
            <div className="relative aspect-square bg-muted">
              {img ? <Image src={img} alt={p.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" /> : null}
            </div>
            <div className="space-y-1 p-3">
              <h2 className="truncate text-sm font-medium">{p.name}</h2>
              {p.short_description ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.short_description}</p> : null}
              <p className="text-sm">
                <span className="font-semibold" style={priceStyle}>{formatMoney(p.price_minor, store.currency)}</span>
                {onSale ? <span className="ml-2 text-xs text-muted-foreground line-through">{formatMoney(p.compare_at_price_minor!, store.currency)}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
