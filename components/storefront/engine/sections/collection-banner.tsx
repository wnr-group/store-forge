import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, CollectionDetailData } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";

import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
interface CollectionBannerSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function CollectionBannerSection({ node, context, sectionId }: CollectionBannerSectionProps) {
  const collection = context.resource as CollectionDetailData | undefined;
  const showDescription = Boolean(node.settings?.showCollectionDescription ?? true);
  const showImage = Boolean(node.settings?.showCollectionImage ?? true);

  const title = collection?.name ?? "Collection";
  const description = collection?.description ?? "";
  const imageUrl = collection?.image_path ? publicImageUrl(collection.image_path) : null;

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section className="border-b border-border bg-[var(--surface,var(--muted))]" {...sfProps}>
      <div className={cn(CONTAINER, "flex flex-col items-center gap-6 py-10 text-center sm:py-14 md:flex-row md:gap-10 md:text-left")}>
        {showImage && imageUrl ? (
          <div className="relative aspect-4/3 w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image src={imageUrl} alt={title} fill sizes="320px" className="object-cover" />
          </div>
        ) : null}

        <div className="flex-1 space-y-3">
          <h1 className="text-3xl leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">{title}</h1>
          {showDescription && description ? (
            <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
          ) : null}

          {blockOrder.length > 0 ? (
            <div className="pt-2">
              {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
