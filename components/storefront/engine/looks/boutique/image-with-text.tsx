import Image from "next/image";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { ImagePlaceholder, resolveImage } from "../../ui";
import { Eyebrow } from "./eyebrow";
import { SHELL } from "./shell";
import type { SectionProps } from "..";

const HEADINGS = "[&_:is(h1,h2,h3)]:text-balance [&_:is(h1,h2,h3)]:font-medium [&_:is(h1,h2,h3)]:leading-[1.08] [&_:is(h1,h2,h3)]:tracking-[-0.01em] [&_:is(h1,h2,h3)]:[font-family:var(--sf-font-heading)] [&_h1]:text-[2.5rem] [&_h2]:text-[2rem] md:[&_h1]:text-[3.25rem] md:[&_h2]:text-[2.75rem]";
const BODY = "[&_.prose]:max-w-[34rem] [&_.prose]:text-[16px] [&_.prose]:leading-8";
const BUTTONS = "flex flex-wrap gap-3 pt-2 [&>div]:pt-0 [&_a]:h-12 [&_a]:rounded-full [&_a]:px-7 [&_a]:text-[14px] [&_a]:font-medium [&_a]:shadow-none [&_a]:transition-colors [&_a]:duration-200";

/**
 * Boutique image with text. Plain: a tall rounded picture beside the text on the page. Panel: the same in one deep-green panel
 * like the hero, with the first button solid white and the others outlined. The text side is the section's own blocks (heading,
 * text, buttons), so each stays editable on the page.
 */
export function BoutiqueImageWithText({ node, context, sectionId }: SectionProps) {
  const { url, alt } = resolveImage(node.settings?.image);
  const eyebrow = String(node.settings?.eyebrow ?? "");
  const panel = node.settings?.variant === "panel";
  const imageRight = node.settings?.imagePosition === "right";
  const width = String(node.settings?.imageWidth ?? "medium");
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const copyIds = ids.filter((id) => blocks[id].type !== "button");
  const buttonIds = ids.filter((id) => blocks[id].type === "button");
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const cols = width === "small" ? "lg:grid-cols-[2fr_3fr]" : width === "large" ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-2";

  const picture = (
    <div className={cn("relative overflow-hidden bg-muted", panel ? "aspect-[4/3] rounded-[22px] lg:aspect-auto lg:min-h-[30rem]" : "aspect-[4/5] rounded-[28px]")}>
      {url ? <Image src={url} alt={alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep={panel} />}
    </div>
  );

  const copy = (
    <div className={cn("flex min-w-0 flex-col justify-center gap-5", panel ? "px-6 py-10 sm:px-10 lg:px-14 lg:py-16" : "py-2", HEADINGS, BODY, panel && "[&_:is(h1,h2,h3)]:text-white [&_.prose]:text-white/75 [&_.prose_a]:text-white")}>
      <Eyebrow tone={panel ? "dark" : "light"} dot>
        {eyebrow}
      </Eyebrow>
      {copyIds.map((id) => renderBlockComponent(blocks[id], context, id))}
      {buttonIds.length > 0 ? (
        <div className={cn(BUTTONS, panel && "[&_a]:border [&_a]:border-white/35 [&_a]:bg-transparent [&_a]:text-white [&_a:hover]:bg-white/10 [&>div:first-child_a]:border-white [&>div:first-child_a]:bg-white [&>div:first-child_a]:text-primary [&>div:first-child_a:hover]:bg-[#e9d6b8]")}>
          {buttonIds.map((id) => renderBlockComponent(blocks[id], context, id))}
        </div>
      ) : null}
    </div>
  );

  return (
    <section className={cn(SHELL, panel ? "py-4 md:py-6" : "py-12 md:py-20")} {...sfProps}>
      {panel ? (
        <div className={cn("grid overflow-hidden rounded-[28px] bg-primary text-primary-foreground", cols)}>
          <div className={cn(imageRight ? "lg:order-2" : "lg:order-1", "p-3 sm:p-4 lg:p-5")}>{picture}</div>
          <div className={imageRight ? "lg:order-1" : "lg:order-2"}>{copy}</div>
        </div>
      ) : (
        <div className={cn("grid items-center gap-10 lg:gap-20", cols)}>
          <div className={cn(imageRight ? "lg:order-2" : "lg:order-1")}>{picture}</div>
          <div className={imageRight ? "lg:order-1" : "lg:order-2"}>{copy}</div>
        </div>
      )}
    </section>
  );
}
