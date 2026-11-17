import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
interface MulticolumnSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function MulticolumnSection({ node, context, sectionId }: MulticolumnSectionProps) {
  const columns = (node.settings?.columns as number) ?? 3;
  const columnAlignment = (node.settings?.columnAlignment as string) ?? "left";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "#ffffff";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const colGridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 5
      ? "sm:grid-cols-3 lg:grid-cols-5"
      : columns === 6
      ? "sm:grid-cols-3 lg:grid-cols-6"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="w-full transition-colors" style={{ backgroundColor }} {...sfProps}>
      <div className={cn(CONTAINER, "py-12 sm:py-16 lg:py-20")}>
        <div className={`grid grid-cols-1 gap-8 sm:gap-10 text-${columnAlignment} ${colGridClass}`}>
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      </div>
    </section>
  );
}
