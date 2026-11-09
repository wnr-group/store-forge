import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

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
    <section className="mx-auto w-full max-w-4xl px-4 py-16" {...sfProps}>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{heading}</h2>
        {subheading ? <p className="mt-3 text-base text-muted-foreground">{subheading}</p> : null}
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card p-6 shadow-xs">
        {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
      </div>
    </section>
  );
}
