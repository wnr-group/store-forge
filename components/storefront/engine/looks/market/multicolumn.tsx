import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { WRAP } from "./ui";
import type { SectionProps } from "..";

const GRID: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

/**
 * Market multi-column: each column is a white bordered card with a teal top edge, a bold title and a short text. An optional
 * label and heading introduce the row. Short titles ("40,000+") work as figures. The columns are the section's own blocks.
 */
export function MarketMulticolumn({ node, context, sectionId }: SectionProps) {
  const columns = Number(node.settings?.columns ?? 3);
  const alignment = String(node.settings?.columnAlignment ?? "left");
  const eyebrow = String(node.settings?.eyebrow ?? "");
  const heading = String(node.settings?.heading ?? "");
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section className={cn(WRAP, "py-3")} {...sfProps}>
      {eyebrow || heading ? (
        <div className="mb-3 space-y-1 px-1">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{eyebrow}</p> : null}
          {heading ? (
            <h2 className="text-balance text-xl font-bold text-primary sm:text-2xl" style={{ fontFamily: "var(--sf-font-heading)" }}>
              {heading}
            </h2>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          GRID[columns] ?? GRID[3],
          alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left",
          "[&>div]:h-full [&>div]:rounded-xl [&>div]:border [&>div]:border-t-[3px] [&>div]:border-border/80 [&>div]:border-t-secondary [&>div]:bg-white [&>div]:p-5 [&>div]:shadow-sm [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-primary [&_h3]:[font-family:var(--sf-font-heading)] [&_p]:text-[14px] [&_p]:leading-6",
        )}
      >
        {ids.map((id) => renderBlockComponent(blocks[id], context, id))}
      </div>
    </section>
  );
}
