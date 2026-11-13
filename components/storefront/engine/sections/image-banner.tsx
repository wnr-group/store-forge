import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
interface ImageBannerSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function ImageBannerSection({ node, context, sectionId }: ImageBannerSectionProps) {
  const imageVal = node.settings?.image as { path?: string; alt?: string } | string | null | undefined;
  const rawPath = imageRawPath(imageVal);
  const altText = typeof imageVal === "object" ? imageVal?.alt ?? "" : "";

  const height = (node.settings?.height as string) ?? "medium";
  const overlayOpacity = (node.settings?.overlayOpacity as number) ?? 30;
  const textAlignment = (node.settings?.textAlignment as string) ?? "center";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const imageUrl = rawPath
    ? rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("/")
      ? rawPath
      : publicImageUrl(rawPath)
    : null;

  const heightClass =
    height === "small" ? "min-h-[280px] sm:min-h-[340px]" : height === "large" ? "min-h-[460px] sm:min-h-[600px]" : "min-h-[380px] sm:min-h-[450px]";

  const alignClass =
    textAlignment === "left"
      ? "items-start text-left"
      : textAlignment === "right"
      ? "items-end text-right"
      : "items-center text-center";

  return (
    <section className={`relative isolate flex ${heightClass} w-full items-center justify-center overflow-hidden bg-muted py-16`} {...sfProps}>
      {imageUrl ? (
        <Image src={imageUrl} alt={altText} fill sizes="100vw" className="-z-10 object-cover" />
      ) : null}
      <div
        className="absolute inset-0 -z-10 bg-black"
        style={{ opacity: overlayOpacity / 100 }}
        aria-hidden
      />
      <div className={cn(CONTAINER, `flex max-w-3xl flex-col gap-4 text-white ${alignClass}`)}>
        {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
      </div>
    </section>
  );
}
