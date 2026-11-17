import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../../blocks";
import { resolveImage } from "../../ui";
import type { SectionProps } from "..";
import { SportHeroSlider, type SportSlide } from "./hero-slider";

const resolveSrc = (value: unknown): string | null => {
  const raw = imageRawPath(value);
  if (!raw) return null;
  return raw.startsWith("http") || raw.startsWith("/") ? raw : publicImageUrl(raw);
};

/**
 * Sport hero. Slides are the hero's "Hero slide" blocks (picture, heading, text, button); the hero's own buttons appear on every
 * slide as secondary buttons. A hero without slide blocks shows its own picture and heading as one slide.
 */
export function SportHero({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const blocks = node.blocks ?? {};
  const ids = node.block_order ?? Object.keys(blocks);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const slides: SportSlide[] = [];
  for (const id of ids) {
    const b = blocks[id];
    if (!b || b.type !== "hero-slide" || (b.disabled && context.mode === "public")) continue;
    const st = b.settings ?? {};
    if (st.mediaType === "video") continue;
    slides.push({ id, src: resolveSrc(st.image), alt: (typeof st.image === "object" && st.image && "alt" in st.image ? String((st.image as { alt?: unknown }).alt ?? "") : "") || "", heading: String(st.heading ?? ""), subheading: String(st.subheading ?? ""), buttonLabel: String(st.buttonLabel ?? ""), href: String(st.link ?? "") });
  }
  const own = resolveImage(node.settings?.image);
  const firstButton = ids.map((id) => blocks[id]).find((b) => b?.type === "button");
  if (slides.length === 0) {
    slides.push({
      id: "own",
      src: own.url,
      alt: own.alt,
      heading: (node.settings?.heading as string) || store.name,
      subheading: (node.settings?.subheading as string) || store.description || "",
      buttonLabel: String(firstButton?.settings?.label ?? ""),
      href: String(firstButton?.settings?.link ?? ""),
    });
  }

  // Slide-less hero: the first button already became the slide's yellow button, so only the others are shown as secondary ones.
  const ctaIds = ids.filter((id) => blocks[id]?.type === "button" && !(slides[0]?.id === "own" && blocks[id] === firstButton));
  const ctas = ctaIds.length > 0 ? <>{ctaIds.map((id) => renderBlockComponent(blocks[id], context, id))}</> : null;
  const eyebrow = (node.settings?.eyebrow as string) || store.name;

  return <SportHeroSlider slides={slides} eyebrow={eyebrow} ctas={ctas} sfProps={sfProps as { "data-sf-section"?: string }} />;
}
