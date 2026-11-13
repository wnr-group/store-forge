import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
interface LogoListSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function LogoListSection({ node, context, sectionId }: LogoListSectionProps) {
  const title = (node.settings?.title as string) ?? "Trusted By";
  const columns = (node.settings?.columns as number) ?? 4;
  const grayscale = Boolean(node.settings?.grayscale ?? true);

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const colGridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : columns === 5
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
      : columns === 6
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-6"
      : columns === 8
      ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-8"
      : "grid-cols-2 sm:grid-cols-4";

  return (
    <section className="w-full border-y border-border/60" {...sfProps}>
      <div className={cn(CONTAINER, "py-10 text-center sm:py-14")}>
        {title ? <h2 className="mb-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2> : null}

        <div className={`grid items-center justify-center gap-8 ${colGridClass} ${grayscale ? "grayscale opacity-75 hover:grayscale-0 hover:opacity-100 transition-all" : ""}`}>
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      </div>
    </section>
  );
}
