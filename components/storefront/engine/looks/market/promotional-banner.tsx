import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionProps } from "..";
import { btnAccent, WRAP } from "./ui";

/**
 * Market promotion band: a rounded teal panel with soft glows. Left: a small label, a heading, text and an orange button
 * (heading, text and button blocks). Right: Column blocks as numbered glass cards ("how it works" steps). With no blocks it
 * shows the title and the highlight text and links to the banner link.
 */
export function MarketPromotionalBanner({ node, context, sectionId }: SectionProps) {
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
    <section className={cn(WRAP, "py-2")} {...sfProps}>
      <div className="relative isolate overflow-hidden rounded-xl bg-[linear-gradient(115deg,var(--primary)_0%,color-mix(in_srgb,var(--secondary)_55%,var(--primary))_55%,var(--secondary)_100%)] px-6 py-12 text-white sm:px-12 lg:px-16 lg:py-16">
        <div aria-hidden className="absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full bg-accent/25 blur-[110px]" />
        <div aria-hidden className="absolute -bottom-40 -left-24 -z-10 size-[24rem] rounded-full bg-primary/80 blur-[90px]" />
        <div className={cn("grid items-center gap-10 lg:gap-14", steps.length > 0 && "lg:grid-cols-[1.1fr_1fr]")}>
          <div className="flex min-w-0 flex-col gap-4">
            {title ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{title}</p> : null}
            {copyIds.map((id) => {
              const b = blocks[id];
              const st = b.settings ?? {};
              if (b.type === "heading") {
                return (
                  <h2 key={id} className="text-balance text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl" style={{ fontFamily: "var(--sf-font-heading)" }}>
                    {String(st.text ?? "")}
                  </h2>
                );
              }
              if (b.type === "text") return <p key={id} className="max-w-lg whitespace-pre-line leading-relaxed text-white/75">{String(st.content ?? "")}</p>;
              if (b.type === "button") {
                return (
                  <div key={id} className="mt-2 flex flex-wrap items-center gap-3">
                    <Link href={String(st.link ?? "/") || "/"} className={btnAccent("lg")}>
                      {String(st.label ?? "")}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                );
              }
              return null;
            })}
            {!hasCopy && highlight ? <p className="max-w-lg text-2xl font-semibold leading-snug">{highlight}</p> : null}
            {!hasCopy ? (
              <div className="mt-2">
                <Link href={href} className={btnAccent("lg")}>
                  Shop now <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>
          {steps.length > 0 ? (
            <ol className="grid gap-3 self-center sm:grid-cols-2">
              {steps.map((id, i) => {
                const st = blocks[id].settings ?? {};
                return (
                  <li key={id} className="rounded-xl bg-white/[0.07] p-5 ring-1 ring-white/15 backdrop-blur">
                    <span className="grid size-7 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground">{i + 1}</span>
                    <p className="mt-3 text-lg font-bold" style={{ fontFamily: "var(--sf-font-heading)" }}>{String(st.title ?? "")}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/70">{String(st.text ?? "").replace(/<[^>]*>/g, "")}</p>
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
