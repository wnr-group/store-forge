import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";

interface ProductTypeBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductTypeBlock({ node, context, blockId }: ProductTypeBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const prefix = (node.settings?.prefix as string) ?? "Type:";
  const showLabel = Boolean(node.settings?.showLabel ?? true);

  const type = product?.type;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  if (!type) return null;

  return (
    <p className="text-xs text-muted-foreground" {...sfProps}>
      {showLabel ? <span className="mr-1">{prefix}</span> : null}
      <span className="font-medium text-foreground">{type}</span>
    </p>
  );
}
