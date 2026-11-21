"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { RichText } from "../richtext-renderer";
import { blockMarkers } from "../markers";

interface CollapsibleItemBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function CollapsibleItemBlock({ node, context, blockId }: CollapsibleItemBlockProps) {
  const heading = (node.settings?.heading as string) ?? "Question";
  const content = (node.settings?.content as string) ?? "";
  const defaultOpen = Boolean(node.settings?.defaultOpen ?? false);

  const [isOpen, setIsOpen] = useState(defaultOpen);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);

  return (
    <div className="border-b border-border py-4" {...sfProps}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left text-base font-medium text-foreground transition-all hover:underline"
        aria-expanded={isOpen}
      >
        <span>{heading}</span>
        <ChevronDown className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <div className="pt-3 text-sm text-muted-foreground">
          <RichText content={content} />
        </div>
      ) : null}
    </div>
  );
}
