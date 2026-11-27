import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { blockMarkers } from "../markers";

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
  const sfProps = blockMarkers(blockId, isPreview, node);

  // The part number is the store's own reference (a manufacturer or catalogue number). It is shown beside the SKU, never instead of it.
  const partNumber = typeof product?.part_number === "string" && product.part_number ? product.part_number : null;

  if (!sku && !partNumber) return null;

  return (
    <p className="text-xs text-muted-foreground" {...sfProps}>
      {sku ? (
        <>
          {showLabel ? <span className="mr-1">{prefix}</span> : null}
          <span className="font-mono font-medium text-foreground">{sku}</span>
        </>
      ) : null}
      {partNumber ? (
        <span className={sku ? "ml-3" : undefined}>
          {showLabel ? <span className="mr-1">Part no.:</span> : null}
          <span className="font-mono font-medium text-foreground">{partNumber}</span>
        </span>
      ) : null}
    </p>
  );
}
