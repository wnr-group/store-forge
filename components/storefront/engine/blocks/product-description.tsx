import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { RichText } from "../richtext-renderer";
import { blockMarkers } from "../markers";

interface ProductDescriptionBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductDescriptionBlock({ node, context, blockId }: ProductDescriptionBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const description = product?.short_description ?? (context.mode === "preview" ? "Product description goes here." : "");
  const truncate = Boolean(node.settings?.truncate ?? false);
  const maxLines = (node.settings?.maxLines as number) ?? 5;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);

  if (!description) return null;

  const lineClampStyle = truncate ? { WebkitLineClamp: maxLines, display: "-webkit-box", WebkitBoxOrient: "vertical" as const, overflow: "hidden" } : undefined;

  return (
    <div className="py-2 text-sm leading-relaxed text-muted-foreground" style={lineClampStyle} {...sfProps}>
      <RichText content={description} />
    </div>
  );
}
