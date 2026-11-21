import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { DisplayHeading, Eyebrow } from "./eyebrow";
import { SHELL } from "./shell";
import type { SectionProps } from "..";

/**
 * Boutique questions and answers: the heading, a short line and an optional pill link on the left, the questions as a
 * ruled list on the right. The questions are the section's own blocks.
 */
export function BoutiqueCollapsibleContent({ node, context, sectionId }: SectionProps) {
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
    <section className={cn(SHELL, "py-12 md:py-20")} {...sfProps}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-20">
        <div className="flex flex-col items-start gap-5 lg:sticky lg:top-28 lg:self-start">
          <Eyebrow dot>{eyebrow}</Eyebrow>
          {heading ? <DisplayHeading>{heading}</DisplayHeading> : null}
          {subheading ? <p className="max-w-sm text-[15px] leading-7 text-pretty text-foreground/70">{subheading}</p> : null}
          {ctaLabel ? (
            <Link href={ctaLink} className="mt-1 inline-flex h-12 items-center gap-2 rounded-full border border-foreground/30 px-6 text-[14px] font-medium text-foreground transition-colors duration-200 hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {ctaLabel}
              <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
            </Link>
          ) : null}
        </div>
        <div className="border-t border-foreground/20 [&>div]:border-foreground/20 [&>div]:py-6 [&_button]:gap-6 [&_button>span]:text-[1.375rem] [&_button>span]:leading-snug [&_button>span]:[font-family:var(--sf-font-heading)] [&_button:hover]:no-underline [&_.prose]:max-w-xl [&_.prose]:text-[15px] [&_.prose]:leading-7">
          {ids.map((id) => renderBlockComponent(blocks[id], context, id))}
        </div>
      </div>
    </section>
  );
}
