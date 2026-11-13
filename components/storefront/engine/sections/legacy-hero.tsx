/** The markup stores on the built-in templates have always had. Kept byte-for-byte (see tests/unit/preset-equivalence.test.ts); themed stores use the new design. */
import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../blocks";

interface LegacyHeroProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function LegacyHeroSection({ node, context, sectionId }: LegacyHeroProps) {
  const store = context.store;
  const variant = (node.settings?.variant as string) ?? "classic";
  const heading = (node.settings?.heading as string) || store.name;
  const subheading = (node.settings?.subheading as string) || store.description || null;
  const accentColor = (node.settings?.accentColor as string) || null;

  const imageVal = node.settings?.image as { path?: string; alt?: string } | string | null | undefined;
  const rawPath = imageRawPath(imageVal);
  const altText = typeof imageVal === "object" ? imageVal?.alt ?? "" : "";

  const imageUrl = rawPath
    ? rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("/")
      ? rawPath
      : publicImageUrl(rawPath)
    : null;

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  // Spotlight Hero Variant
  if (variant === "spotlight") {
    const hasImage = Boolean(imageUrl);
    return (
      <section
        className="relative isolate flex min-h-72 items-center justify-center overflow-hidden bg-muted px-4 py-16 text-center"
        {...sfProps}
      >
        {hasImage ? (
          <>
            <Image src={imageUrl!} alt={altText} fill sizes="100vw" className="-z-10 object-cover" />
            <div className="absolute inset-0 -z-10 bg-black/50" aria-hidden />
          </>
        ) : null}
        <div className={cn("mx-auto max-w-2xl space-y-3", hasImage ? "text-white" : "text-foreground")}>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
          {subheading ? <p className="text-base opacity-90">{subheading}</p> : null}
          <span
            aria-hidden
            className="mx-auto block h-1 w-16 rounded-full bg-primary"
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          />
          {blockOrder.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  // Classic Hero Variant
  if (!imageUrl && !subheading && blockOrder.length === 0 && !isPreview) {
    return null;
  }

  const classicContent = (
    <>
      {imageUrl ? (
        <div className="relative mb-8 aspect-[16/5] overflow-hidden rounded-xl bg-muted">
          <Image src={imageUrl} alt={altText} fill sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
        </div>
      ) : null}
      {subheading ? <p className="mb-8 max-w-2xl text-muted-foreground">{subheading}</p> : null}
      {blockOrder.length > 0 ? (
        <div className="mb-8 flex flex-wrap gap-3">
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      ) : null}
    </>
  );

  if (isPreview && sectionId) {
    return <div {...sfProps}>{classicContent}</div>;
  }

  return classicContent;
}
