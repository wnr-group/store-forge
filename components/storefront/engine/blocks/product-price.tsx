import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { formatMoney } from "@/lib/money";
import { resolveVariant } from "@/lib/templates/variant-selection";

interface ProductPriceBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductPriceBlock({ node, context, blockId }: ProductPriceBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const currency = (context.store?.currency as string) ?? "INR";
  const showCompareAt = Boolean(node.settings?.showCompareAt ?? true);
  const textSize = (node.settings?.textSize as string) ?? "medium";

  const matchedVariant = product?.variants && context.selectedOptions
    ? resolveVariant(product.variants, context.selectedOptions)
    : undefined;

  const priceMinor = matchedVariant?.price_minor ?? product?.price_minor ?? 0;
  const compareAtPriceMinor = matchedVariant
    ? matchedVariant.compare_at_price_minor
    : product?.compare_at_price_minor;

  const onSale = Boolean(compareAtPriceMinor && compareAtPriceMinor > priceMinor);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const sizeClass =
    textSize === "large" ? "text-2xl sm:text-3xl" : textSize === "small" ? "text-base" : "text-xl sm:text-2xl";

  return (
    <div className={`flex items-baseline gap-3 ${sizeClass}`} {...sfProps}>
      <span className="font-bold text-foreground">
        {formatMoney(priceMinor, currency)}
      </span>
      {showCompareAt && onSale && compareAtPriceMinor ? (
        <span className="text-base text-muted-foreground line-through">
          {formatMoney(compareAtPriceMinor, currency)}
        </span>
      ) : null}
    </div>
  );
}
