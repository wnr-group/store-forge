import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { blockMarkers } from "../markers";

interface ProductCompareAtPriceBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductCompareAtPriceBlock({ node, context, blockId }: ProductCompareAtPriceBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const showBadge = Boolean(node.settings?.showBadge ?? true);
  const badgeText = (node.settings?.badgeText as string) ?? "Sale";

  const matchedVariant = product?.variants && context.selectedOptions
    ? resolveVariant(product.variants, context.selectedOptions)
    : undefined;

  const priceMinor = matchedVariant?.price_minor ?? product?.price_minor ?? 0;
  const compareAtPriceMinor = matchedVariant
    ? matchedVariant.compare_at_price_minor
    : product?.compare_at_price_minor;

  const onSale = Boolean(compareAtPriceMinor && compareAtPriceMinor > priceMinor);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);

  if (!onSale || !showBadge) return null;

  return (
    <span
      className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800"
      {...sfProps}
    >
      {badgeText}
    </span>
  );
}
