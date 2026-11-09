import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { RichText } from "../richtext-renderer";

interface TextBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function TextBlock({ node, context, blockId }: TextBlockProps) {
  const content = (node.settings?.content as string) ?? "";
  const alignment = (node.settings?.alignment as string) ?? "left";

  const alignClass = alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left";
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  return (
    <div className={`prose prose-neutral max-w-none text-muted-foreground ${alignClass}`} {...sfProps}>
      <RichText content={content} />
    </div>
  );
}
