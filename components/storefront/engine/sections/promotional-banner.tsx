import React from "react";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
interface PromotionalBannerSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function PromotionalBannerSection({ node, context, sectionId }: PromotionalBannerSectionProps) {
  const title = (node.settings?.title as string) ?? "Special Offer";
  const highlightText = (node.settings?.highlightText as string) ?? "";
  const link = (node.settings?.link as string) ?? "";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "#3b82f6";
  const textColor = (node.settings?.textColor as string) ?? "#ffffff";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section
      className={cn("w-full text-center transition-colors", "py-12 sm:py-16 lg:py-20")}
      style={{ backgroundColor, color: textColor }}
      {...sfProps}
    >
      <div className={cn(CONTAINER, "max-w-4xl space-y-4")}>
        {title ? <h2 className="text-3xl leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">{title}</h2> : null}
        {highlightText ? <p className="mx-auto max-w-xl text-base opacity-90 sm:text-lg">{highlightText}</p> : null}

        {link ? (
          <div className="pt-2">
            <Link
              href={link}
              className="inline-flex items-center justify-center rounded-[var(--radius,0.375rem)] bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-xs hover:bg-slate-100 transition-colors"
            >
              Claim Offer
            </Link>
          </div>
        ) : null}

        {blockOrder.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
