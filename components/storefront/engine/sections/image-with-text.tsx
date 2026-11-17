import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";
import { CONTAINER, ImagePlaceholder, RADIUS, SECTION_Y, resolveImage } from "../ui";
import { cn } from "@/lib/utils";

interface ImageWithTextSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/** A picture beside some text. Stacks on phones (picture first), splits 50/50 or 40/60 from tablet width up. */
export function ImageWithTextSection({ node, context, sectionId }: ImageWithTextSectionProps) {
  const { url: imageUrl, alt: altText } = resolveImage(node.settings?.image);
  const imagePosition = (node.settings?.imagePosition as string) ?? "left";
  const imageWidth = (node.settings?.imageWidth as string) ?? "medium";

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const columns = imageWidth === "small" ? "md:grid-cols-[2fr_3fr]" : imageWidth === "large" ? "md:grid-cols-[3fr_2fr]" : "md:grid-cols-2";

  return (
    <section className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <div className={cn("grid items-center gap-8 md:gap-12 lg:gap-20", columns)}>
        <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-muted md:aspect-[4/5]", RADIUS, imagePosition === "right" && "md:order-2")}>
          {imageUrl ? <Image src={imageUrl} alt={altText} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" />}
        </div>
        <div className="flex flex-col gap-4 [&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:sm:text-3xl [&_h2]:lg:text-4xl">{blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}</div>
      </div>
    </section>
  );
}
