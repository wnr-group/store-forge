import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { RichText } from "../richtext-renderer";
import { blockMarkers } from "../markers";

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
  const sfProps = blockMarkers(blockId, isPreview, node);

  return (
    <div className={`prose prose-neutral max-w-none text-muted-foreground ${alignClass}`} {...sfProps}>
      <RichText content={content} />
    </div>
  );
}
