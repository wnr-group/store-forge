"use client";

import { useState } from "react";
import { ChevronDown, Truck, ShieldCheck, HelpCircle } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { RichText } from "../richtext-renderer";

interface CollapsibleInfoBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function CollapsibleInfoBlock({ node, context, blockId }: CollapsibleInfoBlockProps) {
  const title = (node.settings?.title as string) ?? "Details";
  const content = (node.settings?.content as string) ?? "";
  const icon = (node.settings?.icon as string) ?? "none";

  const [isOpen, setIsOpen] = useState(false);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const renderIcon = () => {
    switch (icon) {
      case "truck":
        return <Truck className="mr-2 size-4 text-muted-foreground" />;
      case "shield":
        return <ShieldCheck className="mr-2 size-4 text-muted-foreground" />;
      case "help":
        return <HelpCircle className="mr-2 size-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="border-t border-border py-3" {...sfProps}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground hover:underline"
        aria-expanded={isOpen}
      >
        <span className="flex items-center">
          {renderIcon()}
          {title}
        </span>
        <ChevronDown className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <div className="pt-2 text-sm text-muted-foreground">
          <RichText content={content} />
        </div>
      ) : null}
    </div>
  );
}
