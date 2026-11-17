import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER, SECTION_Y } from "../ui";
import { cn } from "@/lib/utils";
interface RichTextSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function RichTextSection({ node, context, sectionId }: RichTextSectionProps) {
  const alignment = (node.settings?.alignment as string) ?? "center";
  const maxWidth = (node.settings?.maxWidth as string) ?? "normal";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "#ffffff";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const widthClass =
    maxWidth === "narrow" ? "max-w-2xl" : maxWidth === "wide" ? "max-w-6xl" : "max-w-4xl";

  const alignClass =
    alignment === "left"
      ? "items-start text-left"
      : alignment === "right"
      ? "items-end text-right"
      : "items-center text-center";

  return (
    <section className="w-full transition-colors" style={{ backgroundColor }} {...sfProps}>
      <div className={cn(CONTAINER, SECTION_Y, `flex ${widthClass} flex-col gap-4 ${alignClass}`)}>
        {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
      </div>
    </section>
  );
}
