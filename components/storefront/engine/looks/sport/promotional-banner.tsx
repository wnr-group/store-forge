import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { blockMarkers } from "../../markers";
import type { SectionProps } from "..";
import { HEADLINE_FONT, SHELL, SportEyebrow } from "./ui";

/**
 * Sport promotion band: a rounded indigo panel with a glow. Left: the promotion title as a small label, a heading, text and a
 * yellow button (heading, text and button blocks). Right: Column blocks as numbered glass cards ("how it works" steps).
 * With no blocks it shows the title and the highlight text and links to the banner link.
 */
export function SportPromotionalBanner({ node, context, sectionId }: SectionProps) {
  const title = (node.settings?.title as string) ?? "";
  const highlight = (node.settings?.highlightText as string) ?? "";
  const href = (node.settings?.link as string) || "/products";
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const steps = ids.filter((id) => blocks[id].type === "column");
  const copyIds = ids.filter((id) => blocks[id].type !== "column");
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (!title && !highlight && ids.length === 0) return null;
  const hasCopy = copyIds.length > 0;

  return (
    <section className={cn(SHELL, "py-8 md:py-12")} {...sfProps}>
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--secondary)_80%,#000)_0%,var(--secondary)_60%,color-mix(in_srgb,var(--secondary)_80%,var(--primary))_100%)] px-6 py-10 text-white sm:px-10 md:px-14 md:py-16 lg:px-20">
        <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-[28rem] rounded-full bg-white/15 blur-3xl" />
        <div className={cn("grid items-center gap-10 lg:gap-16", steps.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "")}>
          <div className="flex min-w-0 flex-col gap-6">
            <SportEyebrow tone="light">{title}</SportEyebrow>
            {copyIds.map((id) => {
              const b = blocks[id];
              const st = b.settings ?? {};
              if (b.type === "heading") {
                return (
                  <h2 key={id} className="text-balance text-[1.875rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[2.5rem] xl:text-[3rem]" style={HEADLINE_FONT}>
                    {String(st.text ?? "")}
                  </h2>
                );
              }
              if (b.type === "text") return <p key={id} className="max-w-lg whitespace-pre-line text-[16px] leading-7 text-white/85">{String(st.content ?? "")}</p>;
              if (b.type === "button") {
                return (
                  <div key={id} className="flex flex-wrap items-center gap-5" {...blockMarkers(id, isPreview, b)}>
                    <Link href={String(st.link ?? "/") || "/"} className="inline-flex h-14 items-center gap-2.5 rounded-full bg-accent px-8 text-[16px] font-semibold text-primary shadow-[0_14px_34px_-12px_rgba(251,200,38,0.8)] transition-all hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                      {String(st.label ?? "")}
                      <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
                    </Link>
                  </div>
                );
              }
              return null;
            })}
            {!hasCopy && highlight ? <p className="max-w-lg text-[1.5rem] font-semibold leading-snug">{highlight}</p> : null}
            {!hasCopy ? (
              <div>
                <Link href={href} className="inline-flex h-14 items-center gap-2.5 rounded-full bg-accent px-8 text-[16px] font-semibold text-primary">
                  Shop now <ArrowRight className="size-[18px]" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>
          {steps.length > 0 ? (
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {steps.map((id, i) => {
                const st = blocks[id].settings ?? {};
                return (
                  <li key={id} className="rounded-[1rem] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
                    <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">{i + 1}</span>
                    <p className="mt-4 text-[20px] font-bold" style={HEADLINE_FONT}>
                      {String(st.title ?? "")}
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-white/75">{String(st.text ?? "").replace(/<[^>]*>/g, "")}</p>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  );
}
