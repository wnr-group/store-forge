import Image from "next/image";
import Link from "next/link";
import { ArrowRight, RefreshCw, ShieldCheck, Star, Truck } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import { cn } from "@/lib/utils";
import { ImagePlaceholder, resolveImage } from "../../ui";
import type { SectionProps } from "..";
import { BAND_Y, HEADLINE_FONT, Highlighted, PILL_DARK, PILL_OUTLINE, PILL_YELLOW, SHELL, SportEyebrow } from "./ui";

type Row = { kind: "bullet"; text: string } | { kind: "stat"; value: string; text: string } | { kind: "feature"; title: string; text: string };

/** Reads one line of a text block: "• item", "1979 | text" or "Title :: text". Anything else is a paragraph (null). */
export function parseRow(content: string): Row | null {
  const line = content.trim();
  if (/^[•*-]\s+/.test(line)) return { kind: "bullet", text: line.replace(/^[•*-]\s+/, "") };
  const feature = line.split(" :: ");
  if (feature.length === 2 && feature[0].trim() && feature[1].trim()) return { kind: "feature", title: feature[0].trim(), text: feature[1].trim() };
  const stat = line.split(" | ");
  if (stat.length === 2 && stat[0].trim().length <= 14 && stat[1].trim()) return { kind: "stat", value: stat[0].trim(), text: stat[1].trim() };
  return null;
}

const ICONS = [ShieldCheck, RefreshCw, Truck, Star];

/**
 * Sport "image with text". Two layouts (the Layout style setting): Panel puts text and picture in one tinted, rounded panel with
 * the picture running to the edge; Plain shows a rounded picture beside the text, with an optional label on the picture.
 * Text blocks can be ruled rows (see `parseRow`); buttons follow the block style (primary dark, secondary yellow, outline).
 */
export function SportImageWithText({ node, context, sectionId }: SectionProps) {
  const { url: imageUrl, alt } = resolveImage(node.settings?.image);
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const panel = node.settings?.variant === "panel";
  const upper = Boolean(node.settings?.uppercaseHeading ?? true);
  const badge = (node.settings?.badge as string) ?? "";
  const imageRight = node.settings?.imagePosition === "right";
  const width = (node.settings?.imageWidth as string) ?? "medium";
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const cols = width === "small" ? "md:grid-cols-[2fr_3fr]" : width === "large" ? "md:grid-cols-[3fr_2fr]" : "md:grid-cols-2";

  // Consecutive row-style text blocks are drawn as one ruled list.
  const out: React.ReactNode[] = [];
  let run: { id: string; row: Row }[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const list = run;
    run = [];
    out.push(
      <ul key={`rows-${list[0].id}`} className="border-t border-border">
        {list.map(({ id, row }, n) => (
          <li key={id} className="flex items-center gap-5 border-b border-border py-4 md:py-[18px]">
            {row.kind === "bullet" ? (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
                <span className="text-[18px] text-foreground/85 md:text-[20px]">{row.text}</span>
              </>
            ) : row.kind === "stat" ? (
              <>
                <span className="w-28 shrink-0 text-[1.75rem] font-extrabold leading-none tracking-[-0.02em] text-primary md:w-44" style={HEADLINE_FONT}>
                  {row.value}
                </span>
                <span className="text-[17px] text-foreground/80">{row.text}</span>
              </>
            ) : (
              (() => {
                const Icon = ICONS[n % ICONS.length];
                return (
                  <>
                    <span aria-hidden className="flex size-12 shrink-0 items-center justify-center self-start rounded-[0.75rem] bg-[var(--surface)] text-secondary">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span>
                      <span className="block text-[19px] font-bold text-primary">{row.title}</span>
                      <span className="mt-1.5 block max-w-xl text-[17px] leading-7 text-foreground/75">{row.text}</span>
                    </span>
                  </>
                );
              })()
            )}
          </li>
        ))}
      </ul>,
    );
  };

  for (const id of ids) {
    const b: ComponentNode = blocks[id];
    const st = b.settings ?? {};
    if (b.type === "text") {
      const row = parseRow(String(st.content ?? ""));
      if (row) {
        run.push({ id, row });
        continue;
      }
    }
    flush();
    if (b.type === "heading") {
      out.push(
        <h2 key={id} className={cn("text-balance font-extrabold tracking-[-0.03em] text-primary", upper && "uppercase", panel ? "text-[2.25rem] md:text-[3rem] xl:text-[4rem]" : upper ? "text-[2rem] md:text-[2.5rem] xl:text-[3.25rem]" : "text-[2rem] md:text-[2.5rem] xl:text-[3rem]", upper ? "leading-[0.98]" : "leading-[1.05]")} style={HEADLINE_FONT}>
          <Highlighted text={String(st.text ?? "")} className="text-secondary" />
        </h2>,
      );
    } else if (b.type === "text") {
      out.push(
        <p key={id} className="max-w-xl whitespace-pre-line text-[17px] leading-8 text-foreground/80 md:text-[19px]">
          {String(st.content ?? "")}
        </p>,
      );
    } else if (b.type === "button") {
      const style = String(st.style ?? "primary");
      out.push(
        <div key={id}>
          <Link href={String(st.link ?? "/") || "/"} className={cn(style === "outline" ? PILL_OUTLINE : style === "secondary" ? PILL_YELLOW : PILL_DARK)}>
            {String(st.label ?? "")}
            <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
          </Link>
        </div>,
      );
    }
  }
  flush();

  const copy = (
    <div className={cn("flex min-w-0 flex-col gap-6", panel ? "justify-center px-6 py-10 sm:px-10 md:px-14 md:py-16 lg:px-20" : "")}>
      <SportEyebrow>{eyebrow}</SportEyebrow>
      {out}
    </div>
  );

  if (panel) {
    return (
      <section className={cn(SHELL, "py-6 md:py-10")} {...sfProps}>
        <div className={cn("grid overflow-hidden rounded-[2rem] bg-[var(--surface)]", cols)}>
          <div className={cn(imageRight && "md:order-2")}>{copy}</div>
          <div className={cn("relative min-h-[22rem] bg-muted", imageRight ? "md:order-1" : "md:order-2")}>
            {imageUrl ? <Image src={imageUrl} alt={alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" />}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={cn(SHELL, BAND_Y)} {...sfProps}>
      <div className={cn("grid items-center gap-10 md:gap-14 lg:gap-24", cols)}>
        <div className={cn("relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-[var(--surface)] md:aspect-[4/5]", imageRight && "md:order-2")}>
          {imageUrl ? <Image src={imageUrl} alt={alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" />}
          {badge ? <span className="absolute left-5 top-5 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-secondary shadow-sm">{badge}</span> : null}
        </div>
        {copy}
      </div>
    </section>
  );
}
