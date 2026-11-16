import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../blocks";
import { LegacyHeroSection } from "./legacy-hero";
import { Leaf } from "lucide-react";
import { hasTheme, isEditorialTheme, isGroceryTheme } from "@/lib/templates/engine/theme-style";
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

  // Atelier's hero is always the full-screen campaign, even for stores that applied an older version with another height or variant.
  // Same composition as the StoreForge landing hero, with one picture instead of a slider: the picture fills the section, a dark
  // wash fades in from the left, and the copy sits left-aligned in the vertical middle (eyebrow with a rule, headline, text, one button).
  if (isEditorialTheme(context.theme)) {
    const wash = (a: number) => `rgba(0,0,0,${Math.min(0.9, a).toFixed(2)})`;
    return (
      <section className={cn("relative isolate flex w-full flex-col overflow-hidden text-white max-h-[58rem]", HEIGHTS.fullscreen)} {...sfProps}>
        {imageUrl ? <Image src={imageUrl} alt={altText} fill priority sizes="100vw" className="-z-30 object-cover" /> : <ImagePlaceholder className="absolute inset-0 -z-30" icon={false} deep />}
        {/* Phones: an even wash. From sm up: strongest behind the copy on the left, clear on the right. */}
        <div aria-hidden className="absolute inset-0 -z-20 sm:hidden" style={{ background: wash(overlay + 0.3) }} />
        <div aria-hidden className="absolute inset-0 -z-20 hidden sm:block" style={{ background: `linear-gradient(to right, ${wash(overlay + 0.55)} 0%, ${wash(overlay + 0.2)} 55%, transparent 100%)` }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/70 to-transparent" />
        <div className={cn(CONTAINER, "relative flex flex-1 items-center py-20 sm:py-24")}>
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2.5 text-sm font-medium tracking-wide text-white/90">
              <span aria-hidden className="h-px w-8 bg-white/80" />
              {store.name}
            </p>
            <h1 className="mt-4 text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-[3.75rem]">{heading}</h1>
            {subheading ? <p className="mt-5 max-w-md text-base leading-7 text-pretty text-white/85 sm:text-lg sm:leading-8">{subheading}</p> : null}
            {blockOrder.length > 0 ? (
              <div className="mt-8 flex flex-wrap gap-3 [&>div]:pt-0 [&_a]:inline-flex [&_a]:h-12 [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-[var(--sf-button-radius,0px)] [&_a]:border [&_a]:border-white [&_a]:bg-white [&_a]:px-8 [&_a]:text-[15px] [&_a]:font-medium [&_a]:text-neutral-950 [&_a]:shadow-none [&_a]:transition-colors [&_a]:duration-300 [&_a]:after:content-['→'] [&_a:hover]:bg-transparent [&_a:hover]:text-white">
                {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  // Freshly: a two-column campaign that fills the first screen (viewport minus the announcement bar and the two-tier header).
  // Copy on the left, the photo in a rounded frame on the right; on phones the copy comes first and the photo sits below it.
  if (isGroceryTheme(context.theme)) {
    const cream = "#f8e8d8";
    // Stores that applied Freshly earlier still point at the old illustration (or have no picture): show the campaign photo instead.
    // A picture the merchant chose themselves is kept.
    const heroUrl = imageUrl && !imageUrl.endsWith("/themes/freshly/hero.svg") ? imageUrl : "/themes/freshly/hero.jpg";
    const heroAlt = altText || "A paper bag of fresh vegetables beside a basket of fruit, eggs, milk and bread on a wooden table";
    return (
      <section className="relative isolate w-full overflow-hidden" style={{ backgroundColor: cream }} {...sfProps}>
        <div aria-hidden className="absolute -left-32 top-1/4 -z-10 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className={cn(CONTAINER, "grid items-center gap-8 py-8 lg:min-h-[max(34rem,calc(100svh-9.5rem))] lg:grid-cols-2 lg:gap-14 lg:py-10")}>
          <div className="max-w-xl lg:py-8">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary/15">
              <Leaf className="size-4" aria-hidden />
              {store.name}
            </p>
            <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.02] tracking-tight text-balance text-foreground sm:text-6xl xl:text-[4.25rem]">{heading}</h1>
            {subheading ? <p className="mt-5 max-w-md text-base leading-7 text-pretty text-foreground/75 sm:text-lg sm:leading-8">{subheading}</p> : null}
            {blockOrder.length > 0 ? (
              <div className="mt-9 flex flex-wrap gap-3 [&>div]:pt-0 [&_a]:inline-flex [&_a]:h-13 [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-full [&_a]:bg-primary [&_a]:px-9 [&_a]:text-base [&_a]:font-semibold [&_a]:text-primary-foreground [&_a]:no-underline [&_a]:shadow-[0_14px_28px_-10px_color-mix(in_srgb,var(--primary)_75%,transparent)] [&_a]:transition-[transform,background-color] [&_a]:duration-200 [&_a]:after:content-['→'] [&_a:hover]:-translate-y-0.5 [&_a:hover]:bg-[var(--primary-hover,var(--primary))] motion-reduce:[&_a]:transition-none motion-reduce:[&_a:hover]:translate-y-0">
                {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
              </div>
            ) : null}
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-30px_rgba(60,40,10,0.45)] ring-1 ring-black/5 sm:aspect-[16/10] lg:aspect-auto lg:h-[min(34rem,calc(100svh-13rem))] xl:h-[min(40rem,calc(100svh-13rem))]">
            <Image src={heroUrl} alt={heroAlt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-[72%_center]" />
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
