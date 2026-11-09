import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

interface FooterSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function FooterSection({ node, context, sectionId }: FooterSectionProps) {
  const store = context.store;
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "#f8fafc";
  const textColor = (node.settings?.textColor as string) ?? "#0f172a";
  const copyrightText = (node.settings?.copyrightText as string) ?? "";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const defaultCopyright = `${store.name} · Powered by StoreForge`;

  return (
    <footer
      className="border-t border-border mt-auto w-full transition-colors"
      style={{ backgroundColor, color: textColor }}
      {...sfProps}
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        {blockOrder.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 pb-8 border-b border-border/40">
            {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
          </div>
        ) : null}

        <div className="pt-6 text-center text-sm text-muted-foreground">
          {copyrightText || defaultCopyright}
        </div>
      </div>
    </footer>
  );
}
