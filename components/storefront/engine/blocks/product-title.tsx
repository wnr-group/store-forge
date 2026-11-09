import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";

interface ProductTitleBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductTitleBlock({ node, context, blockId }: ProductTitleBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const name = product?.name ?? (context.mode === "preview" ? "Product Title" : "");
  const level = (node.settings?.level as string) ?? "h1";
  const alignment = (node.settings?.alignment as string) ?? "left";

  const alignClass = alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left";
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  if (!name) return null;

  switch (level) {
    case "h2":
      return (
        <h2 className={`text-2xl font-bold tracking-tight text-foreground sm:text-3xl ${alignClass}`} {...sfProps}>
          {name}
        </h2>
      );
    case "h3":
      return (
        <h3 className={`text-xl font-semibold tracking-tight text-foreground ${alignClass}`} {...sfProps}>
          {name}
        </h3>
      );
    case "h1":
    default:
      return (
        <h1 className={`text-3xl font-bold tracking-tight text-foreground sm:text-4xl ${alignClass}`} {...sfProps}>
          {name}
        </h1>
      );
  }
}
