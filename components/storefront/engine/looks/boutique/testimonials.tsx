import { cn } from "@/lib/utils";
import { SECTION_Y } from "../../ui";
import type { SectionProps } from "..";
import { DisplayHeading, Eyebrow } from "./eyebrow";
import { SHELL } from "./shell";

const GRID: Record<number, string> = {
  1: "grid-cols-1 max-w-2xl",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

/** Whole stars from a rating setting, kept between 1 and 5. */
export const clampRating = (value: unknown): number => {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 5;
  return Math.min(5, Math.max(1, n));
};

/**
 * Boutique reviews: a small label with a dot, a serif heading and white rounded cards. Each card has gold stars, the quote,
 * a hairline and the reviewer: name, then place and product ("Chennai · on Linen Saree"). The cards are exactly the
 * testimonials the merchant added; nothing is invented, and with none the section does not show to shoppers.
 */
export function BoutiqueTestimonials({ node, context, sectionId }: SectionProps) {
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const heading = (node.settings?.heading as string) ?? "What customers say";
  const subheading = (node.settings?.subheading as string) ?? "";
  const columns = Math.min(4, Math.max(1, (node.settings?.columns as number) ?? 3));
  const blocks = node.blocks ?? {};
  const reviews = (node.block_order ?? Object.keys(blocks)).map((id) => ({ id, block: blocks[id] })).filter((r) => r.block?.type === "testimonial" && !(r.block.disabled && context.mode === "public"));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (reviews.length === 0 && !isPreview) return null;

  return (
    <section className={cn(SHELL, SECTION_Y)} {...sfProps}>
      <div className="mb-8 space-y-3 md:mb-10">
        <Eyebrow dot>{eyebrow}</Eyebrow>
        <DisplayHeading>{heading}</DisplayHeading>
        {subheading ? <p className="max-w-xl text-[15px] leading-7 text-muted-foreground">{subheading}</p> : null}
      </div>
      {reviews.length === 0 ? (
        <p className="border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Add testimonials in this section and they appear here as review cards.</p>
      ) : (
        <ul className={cn("grid gap-5", GRID[columns])}>
          {reviews.map(({ id, block }) => {
            const rating = clampRating(block.settings?.rating);
            const quote = (block.settings?.quote as string) ?? "";
            const author = (block.settings?.author as string) ?? "";
            const place = (block.settings?.role as string) ?? "";
            const product = (block.settings?.company as string) ?? "";
            const meta = [place, product ? `on ${product}` : ""].filter(Boolean).join(" · ");
            return (
              <li key={id} className="flex min-w-0 flex-col rounded-[1.375rem] border border-border bg-white p-6 sm:p-8" {...(isPreview ? { "data-sf-block": id } : {})}>
                <p className="flex gap-1 text-[15px] leading-none" role="img" aria-label={`Rated ${rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} aria-hidden className={n <= rating ? "text-accent" : "text-border"}>
                      ★
                    </span>
                  ))}
                </p>
                <blockquote className="mt-5 flex-1 text-[1.0625rem] leading-[1.8] text-foreground">{quote}</blockquote>
                <div className="mt-6 border-t border-border pt-5">
                  <p className="text-[15px] font-medium text-foreground">{author}</p>
                  {meta ? <p className="mt-1 text-[13px] text-muted-foreground">{meta}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
