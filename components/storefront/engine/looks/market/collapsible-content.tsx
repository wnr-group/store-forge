import Link from "next/link";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { btnPrimary, PANEL, WRAP } from "./ui";
import type { SectionProps } from "..";

/**
 * Market questions and answers: one white bordered panel. The heading, a short line and an optional teal button sit on the
 * left, the questions as a ruled list on the right. The questions are the section's own blocks.
 */
export function MarketCollapsibleContent({ node, context, sectionId }: SectionProps) {
  const eyebrow = String(node.settings?.eyebrow ?? "");
  const heading = String(node.settings?.heading ?? "");
  const subheading = String(node.settings?.subheading ?? "");
  const ctaLabel = String(node.settings?.ctaLabel ?? "");
  const ctaLink = String(node.settings?.ctaLink ?? "") || "/contact";
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section className={cn(WRAP, "py-2")} {...sfProps}>
      <div className={cn(PANEL, "grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-14 lg:p-10")}>
        <div className="flex flex-col items-start gap-3">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{eyebrow}</p> : null}
          {heading ? (
            <h2 className="text-balance text-2xl font-bold leading-tight text-primary sm:text-3xl" style={{ fontFamily: "var(--sf-font-heading)" }}>
              {heading}
            </h2>
          ) : null}
          {subheading ? <p className="max-w-sm text-[15px] leading-7 text-foreground/70">{subheading}</p> : null}
          {ctaLabel ? (
            <Link href={ctaLink} className={cn(btnPrimary("lg"), "mt-2")}>
              {ctaLabel}
            </Link>
          ) : null}
        </div>
        <div className="border-t border-border/70 [&>div]:border-border/70 [&>div]:py-4 [&_button]:gap-4 [&_button]:text-[16px] [&_button]:font-semibold [&_button]:text-primary [&_button:hover]:no-underline [&_.prose]:max-w-xl [&_.prose]:text-[14.5px] [&_.prose]:leading-7">
          {ids.map((id) => renderBlockComponent(blocks[id], context, id))}
        </div>
      </div>
    </section>
  );
}
