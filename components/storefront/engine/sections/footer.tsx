import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
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
  // Social links are not columns: they are gathered into one row under the columns, in the order they were added.
  const isSocial = (id: string) => blocks[id]?.type === "social-link";
  const columnIds = blockOrder.filter((id) => !isSocial(id));
  const socialIds = node.settings?.showSocial === false ? [] : blockOrder.filter(isSocial);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const defaultCopyright = `${store.name} · Powered by StoreForge`;

  return (
    <footer
      className="border-t border-border mt-auto w-full transition-colors"
      style={{ backgroundColor, color: textColor, ["--foreground" as string]: textColor, ["--muted-foreground" as string]: `color-mix(in srgb, ${textColor} 72%, ${backgroundColor})` }}
      {...sfProps}
    >
      <div className={cn(CONTAINER, "py-12 sm:py-16")}>
        {columnIds.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 pb-10 border-b border-current/15 md:grid-cols-4 [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
            {columnIds.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
          </div>
        ) : null}
        {socialIds.length > 0 ? (
          <div className={cn("flex flex-wrap items-center justify-center gap-2.5 py-6 sm:justify-start", columnIds.length === 0 && "border-b border-current/15")}>
            {socialIds.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
          </div>
        ) : null}

        <div className="pt-6 text-center text-xs opacity-70 sm:text-sm">
          {copyrightText || defaultCopyright}
        </div>
      </div>
    </footer>
  );
}
