import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { resolveVariant } from "@/lib/templates/variant-selection";

interface ProductSkuBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductSkuBlock({ node, context, blockId }: ProductSkuBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const prefix = (node.settings?.prefix as string) ?? "SKU:";
  const showLabel = Boolean(node.settings?.showLabel ?? true);

  const matchedVariant = product?.variants && context.selectedOptions
    ? resolveVariant(product.variants, context.selectedOptions)
    : undefined;

  const sku = matchedVariant?.sku ?? product?.sku;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  if (!sku) return null;

  return (
    <p className="text-xs text-muted-foreground" {...sfProps}>
      {showLabel ? <span className="mr-1">{prefix}</span> : null}
      <span className="font-mono font-medium text-foreground">{sku}</span>
    </p>
  );
}
