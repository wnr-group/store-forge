import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { LinkBlock } from "./link";

interface LinkColumnBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function LinkColumnBlock({ node, context, blockId }: LinkColumnBlockProps) {
  const title = (node.settings?.title as string) ?? "Quick Links";
  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  return (
    <div className="space-y-3" {...sfProps}>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <ul className="space-y-2">
        {blockOrder.map((childId) => {
          const childNode = blocks[childId];
          if (!childNode || childNode.disabled) return null;
          return (
            <li key={childId}>
              <LinkBlock node={childNode} context={context} blockId={childId} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
