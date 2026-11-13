import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";

interface ImageWithTextSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function ImageWithTextSection({ node, context, sectionId }: ImageWithTextSectionProps) {
  const imageVal = node.settings?.image as { path?: string; alt?: string } | string | null | undefined;
  const rawPath = imageRawPath(imageVal);
  const altText = typeof imageVal === "object" ? imageVal?.alt ?? "" : "";

  const imagePosition = (node.settings?.imagePosition as string) ?? "left";
  const imageWidth = (node.settings?.imageWidth as string) ?? "medium";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const imageUrl = rawPath
    ? rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("/")
      ? rawPath
      : publicImageUrl(rawPath)
    : null;

  const imageSpanClass =
    imageWidth === "small" ? "md:w-1/3" : imageWidth === "large" ? "md:w-2/3" : "md:w-1/2";
  const textSpanClass =
    imageWidth === "small" ? "md:w-2/3" : imageWidth === "large" ? "md:w-1/3" : "md:w-1/2";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16" {...sfProps}>
      <div className={`flex flex-col gap-8 md:items-center ${imagePosition === "right" ? "md:flex-row-reverse" : "md:flex-row"}`}>
        {/* Media Column */}
        <div className={`w-full ${imageSpanClass}`}>
          {imageUrl ? (
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-muted shadow-xs">
              <Image src={imageUrl} alt={altText} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="flex aspect-4/3 w-full items-center justify-center rounded-xl bg-muted text-muted-foreground text-sm">
              Image placeholder
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className={`flex w-full flex-col gap-4 ${textSpanClass}`}>
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      </div>
    </section>
  );
}
