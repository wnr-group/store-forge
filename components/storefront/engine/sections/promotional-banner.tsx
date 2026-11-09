import React from "react";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

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
      className="w-full px-4 py-12 text-center transition-colors"
      style={{ backgroundColor, color: textColor }}
      {...sfProps}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {title ? <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2> : null}
        {highlightText ? <p className="text-base font-medium opacity-90">{highlightText}</p> : null}

        {link ? (
          <div className="pt-2">
            <Link
              href={link}
              className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-xs hover:bg-slate-100 transition-colors"
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
