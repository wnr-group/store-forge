import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { blockMarkers } from "../markers";

interface LinkBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function LinkBlock({ node, context, blockId }: LinkBlockProps) {
  const label = (node.settings?.label as string) ?? "Link";
  const url = (node.settings?.url as string) ?? "/";
  const openInNewTab = Boolean(node.settings?.openInNewTab);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);
  const targetProps = openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <Link
      href={url || "/"}
      className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
      {...sfProps}
      {...targetProps}
    >
      {label}
    </Link>
  );
}
