import React from "react";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
interface AnnouncementBarSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function AnnouncementBarSection({ node, context, sectionId }: AnnouncementBarSectionProps) {
  const text = (node.settings?.text as string) ?? "Welcome to our store";
  const link = (node.settings?.link as string) ?? "";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "#0f172a";
  const textColor = (node.settings?.textColor as string) ?? "#ffffff";
  const alignment = (node.settings?.alignment as string) ?? "center";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const alignClass =
    alignment === "left" ? "justify-start text-left" : alignment === "right" ? "justify-end text-right" : "justify-center text-center";

  const content = link ? (
    <Link href={link} className="hover:underline">
      {text}
    </Link>
  ) : (
    <span>{text}</span>
  );

  return (
    <div
      className="w-full py-2.5 text-xs font-medium transition-colors sm:text-[13px]"
      style={{ backgroundColor, color: textColor }}
      {...sfProps}
    >
      <div className={cn(CONTAINER, `flex items-center gap-4 ${alignClass}`)}>
        <div>{content}</div>
        {blockOrder.length > 0 ? (
          <div className="flex items-center gap-3">
            {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
