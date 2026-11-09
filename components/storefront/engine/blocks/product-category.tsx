import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";

interface ProductCategoryBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ProductCategoryBlock({ node, context, blockId }: ProductCategoryBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const linkToCategory = Boolean(node.settings?.linkToCategory ?? true);

  const categoryName = product?.category;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  if (!categoryName) return null;

  return (
    <div className="text-xs text-muted-foreground" {...sfProps}>
      <span>Category: </span>
      {linkToCategory ? (
        <Link href={`/collections`} className="font-medium text-foreground hover:underline">
          {categoryName}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{categoryName}</span>
      )}
    </div>
  );
}
