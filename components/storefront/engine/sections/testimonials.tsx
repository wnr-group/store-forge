import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

interface TestimonialsSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function TestimonialsSection({ node, context, sectionId }: TestimonialsSectionProps) {
  const heading = (node.settings?.heading as string) ?? "What Our Customers Say";
  const subheading = (node.settings?.subheading as string) ?? "";
  const columns = (node.settings?.columns as number) ?? 3;

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const colGridClass =
    columns === 1
      ? "grid-cols-1 max-w-2xl"
      : columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="w-full bg-muted/30 px-4 py-16" {...sfProps}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{heading}</h2>
          {subheading ? <p className="mt-3 text-base text-muted-foreground">{subheading}</p> : null}
        </div>

        <div className={`mx-auto grid gap-6 ${colGridClass}`}>
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      </div>
    </section>
  );
}
