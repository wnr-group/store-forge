import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";

interface HeadingBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function HeadingBlock({ node, context, blockId }: HeadingBlockProps) {
  const text = (node.settings?.text as string) ?? "Heading";
  const level = (node.settings?.level as string) ?? "h2";
  const alignment = (node.settings?.alignment as string) ?? "left";

  const alignClass = alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left";
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  switch (level) {
    case "h1":
      return (
        <h1 className={`text-3xl font-bold tracking-tight sm:text-4xl ${alignClass}`} {...sfProps}>
          {text}
        </h1>
      );
    case "h3":
      return (
        <h3 className={`text-xl font-semibold tracking-tight ${alignClass}`} {...sfProps}>
          {text}
        </h3>
      );
    case "h4":
      return (
        <h4 className={`text-lg font-medium tracking-tight ${alignClass}`} {...sfProps}>
          {text}
        </h4>
      );
    case "h2":
    default:
      return (
        <h2 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${alignClass}`} {...sfProps}>
          {text}
        </h2>
      );
  }
}
