import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER, SECTION_Y } from "../ui";
import { cn } from "@/lib/utils";
interface CollapsibleContentSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function CollapsibleContentSection({ node, context, sectionId }: CollapsibleContentSectionProps) {
  const heading = (node.settings?.heading as string) ?? "Frequently Asked Questions";
  const subheading = (node.settings?.subheading as string) ?? "";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section className={cn(CONTAINER, SECTION_Y, "max-w-4xl")} {...sfProps}>
      <div className="mb-8 text-center">
        <h2 className="text-2xl tracking-tight text-foreground sm:text-3xl lg:text-4xl">{heading}</h2>
        {subheading ? <p className="mt-3 text-base text-muted-foreground">{subheading}</p> : null}
      </div>

      <div className="divide-y divide-border rounded-[var(--radius,0.5rem)] border border-border bg-card px-4 py-2 sm:px-6">
        {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
      </div>
    </section>
  );
}
