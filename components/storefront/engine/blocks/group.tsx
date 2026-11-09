import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";

interface GroupBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
  renderBlock?: (node: ComponentNode, id: string) => React.ReactNode;
}

export function GroupBlock({ node, context, blockId, renderBlock }: GroupBlockProps) {
  const direction = (node.settings?.direction as string) ?? "vertical";
  const gap = (node.settings?.gap as number) ?? 16;
  const alignment = (node.settings?.alignment as string) ?? "start";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const alignClass =
    alignment === "center" ? "items-center" : alignment === "end" ? "items-end" : "items-start";

  const dirClass = direction === "horizontal" ? "flex flex-row flex-wrap" : "flex flex-col";

  return (
    <div
      className={`${dirClass} ${alignClass}`}
      style={{ gap: `${gap}px` }}
      {...sfProps}
    >
      {blockOrder.map((childId) => {
        const child = blocks[childId];
        if (!child || child.disabled) return null;
        return <React.Fragment key={childId}>{renderBlock ? renderBlock(child, childId) : null}</React.Fragment>;
      })}
    </div>
  );
}
