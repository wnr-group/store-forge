import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { renderBlockComponent } from "../../blocks";
import { SHELL } from "./shell";
import type { SectionProps } from "..";

/** Boutique promotion: a rounded panel in the colours the store chose, a display headline and a pill link. */
export function BoutiquePromotionalBanner({ node, context, sectionId }: SectionProps) {
  const title = (node.settings?.title as string) ?? "";
  const highlight = (node.settings?.highlightText as string) ?? "";
  const href = (node.settings?.link as string) || "/products";
  const background = (node.settings?.backgroundColor as string) || "#10362f";
  const color = (node.settings?.textColor as string) || "#ffffff";
  const blocks = node.blocks ?? {};
  const ids = node.block_order ?? Object.keys(blocks);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (!title && !highlight) return null;

  return (
    <section className={`${SHELL} py-4 md:py-6`} {...sfProps}>
      <div className="flex flex-col gap-6 rounded-[1.375rem] px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between md:px-14 md:py-12" style={{ backgroundColor: background, color }}>
        <div className="max-w-2xl space-y-3">
          <h2 className="text-balance text-[1.875rem] leading-tight tracking-[-0.01em] md:text-[2.25rem]" style={{ fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" }}>
            {title}
          </h2>
          {highlight ? <p className="text-[15px] leading-7 opacity-85">{highlight}</p> : null}
          {ids.length > 0 ? <div className="[&>div]:pt-0">{ids.map((id) => renderBlockComponent(blocks[id], context, id))}</div> : null}
        </div>
        <Link
          href={href}
          className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full border px-6 text-[14px] font-medium transition-opacity duration-200 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:self-auto"
          style={{ borderColor: color, color, outlineColor: color }}
        >
          Shop the edit
          <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
