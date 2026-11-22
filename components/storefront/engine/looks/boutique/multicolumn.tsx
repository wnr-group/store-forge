import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { DisplayHeading, Eyebrow } from "./eyebrow";
import { SHELL } from "./shell";
import type { SectionProps } from "..";

const GRID: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

/**
 * Boutique multi-column: columns under a thin rule, each with a serif title and quiet text. An optional label and heading
 * introduce the row. Short titles ("1998", "12") work as figures. The columns are the section's own blocks.
 */
export function BoutiqueMulticolumn({ node, context, sectionId }: SectionProps) {
  const columns = Number(node.settings?.columns ?? 3);
  const alignment = String(node.settings?.columnAlignment ?? "left");
  const background = String(node.settings?.backgroundColor ?? "transparent");
  const eyebrow = String(node.settings?.eyebrow ?? "");
  const heading = String(node.settings?.heading ?? "");
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const center = alignment === "center";

  return (
    <section className="w-full" style={{ backgroundColor: background }} {...sfProps}>
      <div className={cn(SHELL, "py-12 md:py-20")}>
        {eyebrow || heading ? (
          <div className={cn("mb-10 flex max-w-2xl flex-col gap-4 md:mb-14", center && "mx-auto items-center text-center")}>
            <Eyebrow dot>{eyebrow}</Eyebrow>
            {heading ? <DisplayHeading>{heading}</DisplayHeading> : null}
          </div>
        ) : null}
        <div
          className={cn(
            "grid grid-cols-1 gap-x-10 gap-y-10 lg:gap-x-14",
            GRID[columns] ?? GRID[3],
            center ? "text-center" : alignment === "right" ? "text-right" : "text-left",
            "[&>div]:border-t [&>div]:border-foreground/20 [&>div]:pt-6 [&_h3]:text-[1.625rem] [&_h3]:font-medium [&_h3]:leading-snug [&_h3]:tracking-[-0.01em] [&_h3]:[font-family:var(--sf-font-heading)] [&_p]:text-[15px] [&_p]:leading-7",
          )}
        >
          {ids.map((id) => renderBlockComponent(blocks[id], context, id))}
        </div>
      </div>
    </section>
  );
}
