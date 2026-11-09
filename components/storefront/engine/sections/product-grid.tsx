import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";

interface ProductGridSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function ProductGridSection({ node, context, sectionId }: ProductGridSectionProps) {
  const store = context.store;
  const accent = (node.settings?.accentColor as string) || null;
  const priceStyle = accent ? { color: accent } : undefined;

  // Products come from resource (if on a collection page) or store
  const collectionResource = context.resource as
    | {
        products?: Array<{
          name: string;
          slug: string;
          short_description?: string | null;
          price_minor: number;
          compare_at_price_minor?: number | null;
          image_path?: string | null;
        }>;
      }
    | undefined;
  const products = collectionResource?.products ?? store.products ?? [];

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  if (products.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground" {...sfProps}>
        Products are coming soon.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" {...sfProps}>
      {products.map((p) => {
        const img = publicImageUrl(p.image_path);
        const onSale = p.compare_at_price_minor !== null && p.compare_at_price_minor !== undefined && p.compare_at_price_minor > p.price_minor;
        const basePath = context.basePath ?? "";
        const productHref = `${basePath}/products/${p.slug}`;
        const shouldLink = (context.linkCards === true || (context.basePath !== undefined && context.basePath !== null)) && !!p.slug;

        const cardBody = (
          <>
            <div className="relative aspect-square bg-muted">
              {img ? (
                <Image src={img} alt={p.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
              ) : null}
            </div>
            <div className="space-y-1 p-3">
              <h2 className="truncate text-sm font-medium">{p.name}</h2>
              {p.short_description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{p.short_description}</p>
              ) : null}
              <p className="text-sm">
                <span className="font-semibold" style={priceStyle}>
                  {formatMoney(p.price_minor, store.currency ?? "INR")}
                </span>
                {onSale ? (
                  <span className="ml-2 text-xs text-muted-foreground line-through">
                    {formatMoney(p.compare_at_price_minor!, store.currency ?? "INR")}
                  </span>
                ) : null}
              </p>
            </div>
          </>
        );

        return (
          <li key={p.slug} className="overflow-hidden rounded-xl border bg-card">
            {shouldLink ? (
              <Link href={productHref} className="group block h-full">
                {cardBody}
              </Link>
            ) : (
              cardBody
            )}
          </li>
        );
      })}
    </ul>
  );
}
