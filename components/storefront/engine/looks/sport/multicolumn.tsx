import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ImagePlaceholder, resolveImage } from "../../ui";
import { RichText } from "../../richtext-renderer";
import type { SectionProps } from "..";
import { BAND_Y, HEADLINE_FONT, SHELL, SportEyebrow } from "./ui";
import { blockMarkers } from "../../markers";

const GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-6",
};

/**
 * Sport multi-column ("Look closer at the cloth"): an optional label and heading, then columns of square picture, bold capital
 * title and a short text. A column without a picture is text only (title, text), set on the tinted background.
 */
export function SportMulticolumn({ node, context, sectionId }: SectionProps) {
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const heading = (node.settings?.heading as string) ?? "";
  const columns = Math.min(6, Math.max(1, (node.settings?.columns as number) ?? 3));
  const blocks = node.blocks ?? {};
  const cols = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id]?.type === "column" && !(blocks[id].disabled && context.mode === "public"));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (cols.length === 0 && !isPreview) return null;
  const anyImage = cols.some((id) => resolveImage(blocks[id].settings?.image).url);

  return (
    <section {...sfProps}>
      <div className={cn(SHELL, BAND_Y)}>
        {eyebrow || heading ? (
          <div className="mb-9 space-y-4 md:mb-12">
            <SportEyebrow>{eyebrow}</SportEyebrow>
            {heading ? (
              <h2 className="max-w-3xl whitespace-pre-line text-balance text-[2rem] font-extrabold uppercase leading-[1] tracking-[-0.025em] text-primary md:text-[2.5rem] xl:text-[3rem]" style={HEADLINE_FONT}>
                {heading}
              </h2>
            ) : null}
          </div>
        ) : null}
        <ul className={cn("grid gap-x-6 gap-y-10", GRID[columns])}>
          {cols.map((id) => {
            const st = blocks[id].settings ?? {};
            const { url, alt } = resolveImage(st.image);
            const title = String(st.title ?? "");
            const text = String(st.text ?? "");
            const href = String(st.linkUrl ?? "");
            const body = (
              <>
                {anyImage ? (
                  <div className="relative mb-5 aspect-[4/5] overflow-hidden bg-[var(--surface)]">
                    {url ? <Image src={url} alt={alt} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" />}
                  </div>
                ) : null}
                <h3 className="text-[16px] font-extrabold uppercase tracking-[0.01em] text-primary">{title}</h3>
                <div className="mt-2 text-[14.5px] leading-7 text-foreground/75 [&_p]:m-0">
                  <RichText content={text} />
                </div>
              </>
            );
            return (
              <li key={id} className={cn("group min-w-0", !anyImage && "rounded-[1rem] bg-[var(--surface)] p-7")} {...blockMarkers(id, isPreview, blocks[id])}>
                {href ? (
                  <Link href={href} className="block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
