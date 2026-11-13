import React from "react";
import { ArrowDown } from "lucide-react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../blocks";
import { LegacyHeroSection } from "./legacy-hero";
import { hasTheme, isEditorialTheme } from "@/lib/templates/engine/theme-style";
import { CONTAINER, ImagePlaceholder, RADIUS, resolveImage } from "../ui";

interface HeroSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

const HEIGHTS: Record<string, string> = {
  small: "min-h-[340px] sm:min-h-[400px]",
  medium: "min-h-[460px] sm:min-h-[540px] lg:min-h-[600px]",
  large: "min-h-[540px] sm:min-h-[640px] lg:min-h-[760px]",
  /** The first screen: the viewport minus the sticky header (4rem on phones, 5rem on desktop). */
  fullscreen: "min-h-[max(34rem,calc(100svh-4rem))] lg:min-h-[max(40rem,calc(100svh-5rem))]",
};

/**
 * The first screen of a page. Variants:
 *  - banner: a full-width picture with the text over it (the merchant's own image, or a themed panel until they add one)
 *  - split: text on one side, picture on the other, stacked on phones
 *  - spotlight: centred text over the picture
 *  - classic: a plain intro with a picture strip underneath (kept for stores that already use it)
 * Every variant reads the same settings, so switching variant in the editor never loses the heading or the image.
 */
export function HeroSection({ node, context, sectionId }: HeroSectionProps) {
  // No theme applied: the store keeps its built-in template, whose markup must not change.
  if (!hasTheme(context.theme)) return <LegacyHeroSection node={node} context={context} sectionId={sectionId} />;
  const store = context.store;
  const variant = (node.settings?.variant as string) ?? "classic";
  const heading = (node.settings?.heading as string) || store.name;
  const subheading = (node.settings?.subheading as string) || store.description || null;
  const accentColor = (node.settings?.accentColor as string) || null;
  const alignment = (node.settings?.alignment as string) === "center" ? "center" : "left";
  const height = HEIGHTS[(node.settings?.height as string) ?? "medium"] ?? HEIGHTS.medium;
  const darkText = (node.settings?.textTone as string) === "dark";
  const overlay = Math.min(80, Math.max(0, Number(node.settings?.overlay ?? 35))) / 100;

  const { url: imageUrl, alt: altText } = resolveImage(node.settings?.image);

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);
  const buttons =
    blockOrder.length > 0 ? (
      <div className={cn("flex flex-wrap gap-3 pt-2 [&>div]:pt-0", alignment === "center" && "justify-center")}>{blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}</div>
    ) : null;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const accentBar = <span aria-hidden className={cn("block h-0.5 w-12 bg-primary", alignment === "center" && "mx-auto")} style={accentColor ? { backgroundColor: accentColor } : undefined} />;

  // Banner: the picture fills the whole section.
  if (variant === "banner" && isEditorialTheme(context.theme) && ["large", "fullscreen"].includes((node.settings?.height as string) ?? "")) {
    return (
      <section className={cn("relative isolate flex w-full flex-col overflow-hidden text-white", HEIGHTS.fullscreen)} {...sfProps}>
        {imageUrl ? <Image src={imageUrl} alt={altText} fill priority sizes="100vw" className="-z-20 object-cover" /> : <ImagePlaceholder className="absolute inset-0 -z-20" icon={false} deep />}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, rgba(0,0,0,${Math.min(0.8, overlay + 0.35)}) 0%, rgba(0,0,0,${overlay * 0.5}) 45%, rgba(0,0,0,${overlay * 0.35}) 100%), linear-gradient(to right, rgba(0,0,0,${overlay * 0.9}) 0%, transparent 60%)` }} />
        <div className={cn(CONTAINER, "flex flex-1 flex-col justify-end pt-24 pb-10 sm:pb-14 lg:pb-16")}>
          <div className="max-w-3xl space-y-6 sm:space-y-8">
            <div className="flex items-center gap-4">
              <span aria-hidden className="block h-px w-12 bg-white/80 sm:w-16" style={accentColor ? { backgroundColor: accentColor } : undefined} />
              <p className="text-[0.7rem] tracking-[0.32em] text-white/85 uppercase sm:text-xs">{store.name}</p>
            </div>
            <h1 className="text-[2.75rem] leading-[1] tracking-tight text-balance sm:text-7xl lg:text-8xl">{heading}</h1>
            {subheading ? <p className="max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">{subheading}</p> : null}
            {buttons}
          </div>
          <div className="mt-12 flex items-center justify-between gap-6 border-t border-white/25 pt-5 text-[0.7rem] tracking-[0.28em] text-white/75 uppercase sm:mt-16">
            <span>Scroll to explore</span>
            <ArrowDown className="size-4" strokeWidth={1.25} />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "banner" || variant === "spotlight") {
    const centered = variant === "spotlight" || alignment === "center";
    const light = Boolean(imageUrl) && !darkText;
    return (
      <section className={cn("relative isolate flex w-full items-center overflow-hidden", variant === "spotlight" ? HEIGHTS.small : height)} {...sfProps}>
        {imageUrl ? <Image src={imageUrl} alt={altText} fill priority sizes="100vw" className="-z-20 object-cover" /> : <ImagePlaceholder className="absolute inset-0 -z-20" icon={false} />}
        {imageUrl ? <div aria-hidden className="absolute inset-0 -z-10" style={{ background: darkText ? `rgba(255,255,255,${overlay})` : centered ? `rgba(0,0,0,${overlay})` : `linear-gradient(to right, rgba(0,0,0,${Math.min(0.85, overlay + 0.2)}) 0%, rgba(0,0,0,${overlay * 0.6}) 55%, rgba(0,0,0,${overlay * 0.2}) 100%)` }} /> : null}
        <div className={cn(CONTAINER, "py-16 sm:py-24")}>
          <div className={cn("max-w-2xl space-y-5", centered && "mx-auto text-center", light ? "text-white" : "text-foreground")}>
            {accentBar}
            <h1 className="text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl">{heading}</h1>
            {subheading ? <p className={cn("max-w-xl text-base leading-relaxed sm:text-lg", light ? "text-white/85" : "text-muted-foreground", centered && "mx-auto")}>{subheading}</p> : null}
            {buttons}
          </div>
        </div>
      </section>
    );
  }

  // Split: copy beside the picture, picture below the copy on phones.
  if (variant === "split") {
    return (
      <section className="w-full bg-[var(--surface,var(--muted))]" {...sfProps}>
        <div className={cn(CONTAINER, "grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-16 lg:py-20")}>
          <div className={cn("space-y-5", alignment === "center" && "text-center lg:text-left")}>
            {accentBar}
            <h1 className="text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl">{heading}</h1>
            {subheading ? <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{subheading}</p> : null}
            {buttons}
          </div>
          <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-[16/10] lg:aspect-[6/5]", RADIUS)}>
            {imageUrl ? <Image src={imageUrl} alt={altText} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" />}
          </div>
        </div>
      </section>
    );
  }

  // Classic: intro text, then the picture as a wide strip.
  if (!imageUrl && !subheading && blockOrder.length === 0 && !isPreview) return null;
  return (
    <section className={cn(CONTAINER, "py-8 sm:py-10")} {...sfProps}>
      {imageUrl ? (
        <div className={cn("relative mb-8 aspect-[16/9] overflow-hidden bg-muted sm:aspect-[16/6]", RADIUS)}>
          <Image src={imageUrl} alt={altText} fill priority sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
        </div>
      ) : null}
      {subheading ? <p className="mb-6 max-w-2xl text-muted-foreground">{subheading}</p> : null}
      {buttons}
    </section>
  );
}
