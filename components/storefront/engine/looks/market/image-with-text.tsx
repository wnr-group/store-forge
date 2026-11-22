import Image from "next/image";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { ImagePlaceholder, resolveImage } from "../../ui";
import { PANEL, WRAP } from "./ui";
import type { SectionProps } from "..";

const HEADINGS = "[&_:is(h1,h2,h3)]:text-balance [&_:is(h1,h2,h3)]:font-bold [&_:is(h1,h2,h3)]:leading-tight [&_:is(h1,h2,h3)]:[font-family:var(--sf-font-heading)] [&_h1]:text-3xl [&_h2]:text-2xl sm:[&_h1]:text-4xl sm:[&_h2]:text-3xl lg:[&_h1]:text-[2.75rem] lg:[&_h2]:text-4xl";
const BODY = "[&_.prose]:max-w-xl [&_.prose]:text-[15px] [&_.prose]:leading-7";
const BUTTONS = "flex flex-wrap gap-3 pt-2 [&>div]:pt-0 [&_a]:h-11 [&_a]:rounded-lg [&_a]:px-5 [&_a]:text-[15px] [&_a]:font-semibold [&_a]:shadow-sm [&_a]:transition-colors [&>div:first-child_a]:border [&>div:first-child_a]:border-black/10 [&>div:first-child_a]:bg-accent [&>div:first-child_a]:text-accent-foreground [&>div:first-child_a:hover]:bg-accent [&>div:first-child_a:hover]:brightness-95";

/**
 * Market image with text. Plain: a white bordered panel with the picture beside the text. Panel: the same in the dark teal
 * gradient the promotion band uses. The first button is the orange "buy" button, the rest are outlined. The text side is the
 * section's own blocks (heading, text, buttons), so each stays editable on the page.
 */
export function MarketImageWithText({ node, context, sectionId }: SectionProps) {
  const { url, alt } = resolveImage(node.settings?.image);
  const eyebrow = String(node.settings?.eyebrow ?? "");
  const dark = node.settings?.variant === "panel";
  const imageRight = node.settings?.imagePosition === "right";
  const width = String(node.settings?.imageWidth ?? "medium");
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const copyIds = ids.filter((id) => blocks[id].type !== "button");
  const buttonIds = ids.filter((id) => blocks[id].type === "button");
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const cols = width === "small" ? "lg:grid-cols-[2fr_3fr]" : width === "large" ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-2";

  return (
    <section className={cn(WRAP, "py-2")} {...sfProps}>
      <div className={cn("grid overflow-hidden", cols, dark ? "rounded-xl bg-[linear-gradient(115deg,var(--primary)_0%,color-mix(in_srgb,var(--secondary)_55%,var(--primary))_55%,var(--secondary)_100%)] text-white" : PANEL)}>
        <div className={cn("relative min-h-[16rem] lg:min-h-[24rem]", imageRight ? "lg:order-2" : "lg:order-1")}>
          {url ? <Image src={url} alt={alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep={dark} />}
        </div>
        <div className={cn("flex min-w-0 flex-col justify-center gap-4 px-6 py-10 sm:px-10 lg:px-14 lg:py-14", imageRight ? "lg:order-1" : "lg:order-2", HEADINGS, BODY, dark ? "[&_:is(h1,h2,h3)]:text-white [&_.prose]:text-white/80 [&_.prose_a]:text-white" : "[&_:is(h1,h2,h3)]:text-primary [&_.prose]:text-foreground/75")}>
          {eyebrow ? <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", dark ? "text-accent" : "text-secondary")}>{eyebrow}</p> : null}
          {copyIds.map((id) => renderBlockComponent(blocks[id], context, id))}
          {buttonIds.length > 0 ? (
            <div className={cn(BUTTONS, dark ? "[&_a]:border [&_a]:border-white/30 [&_a]:bg-white/10 [&_a]:text-white [&_a:hover]:bg-white/20" : "[&_a]:border [&_a]:border-border [&_a]:bg-white [&_a]:text-foreground [&_a:hover]:bg-muted")}>
              {buttonIds.map((id) => renderBlockComponent(blocks[id], context, id))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
