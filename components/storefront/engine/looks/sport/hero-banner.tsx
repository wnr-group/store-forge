import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HEADLINE_FONT, SHELL } from "./ui";

/** The first word of a title is white and the rest is muted: "ALL | PRODUCTS", "TRACKS | GENTS". */
function TwoTone({ title }: { title: string }) {
  const [first, ...rest] = title.trim().split(/\s+/);
  return (
    <>
      <span className="text-white">{first}</span>
      {rest.length > 0 ? <span className="text-white/50"> {rest.join(" ")}</span> : null}
    </>
  );
}

/**
 * The dark, rounded banner at the top of listing pages: breadcrumb, a big two-tone title and a short text, with the collection's
 * picture fading in from the right.
 */
export function SportHeroBanner({ eyebrow, title, text, imageUrl, crumbs, sfProps, titleOv, textOv }: { eyebrow?: string; title: string; text?: string; imageUrl?: string | null; crumbs?: { label: string; href?: string }[]; sfProps?: Record<string, string>; titleOv?: Record<string, string>; textOv?: Record<string, string> }) {
  return (
    <section className={cn(SHELL, "pt-5 md:pt-6")} {...sfProps}>
      <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary px-6 py-10 sm:px-10 md:px-14 md:py-16 lg:px-16 lg:py-20">
        {imageUrl ? (
          <>
            <Image src={imageUrl} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[70%_30%]" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--primary)_0%,color-mix(in_srgb,var(--primary)_92%,transparent)_38%,color-mix(in_srgb,var(--primary)_40%,transparent)_70%,transparent_100%)]" />
          </>
        ) : (
          <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-[30rem] rounded-full bg-secondary/50 blur-3xl" />
        )}
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
            <ol className="flex flex-wrap items-center gap-2">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-2">
                  {i > 0 ? <span aria-hidden>/</span> : null}
                  {c.href ? <Link href={c.href} className="transition-colors hover:text-white">{c.label}</Link> : <span aria-current="page" className="text-white/85">{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="mb-4 flex items-center text-[12px] font-bold uppercase tracking-[0.16em] text-white/85">
            <span aria-hidden className="mr-2.5 size-1.5 rounded-full bg-accent" />
            {eyebrow}
          </p>
        ) : null}
        <h1 {...titleOv} className="max-w-3xl text-balance text-[2.25rem] font-extrabold uppercase leading-[1] tracking-[-0.03em] md:text-[3.25rem] xl:text-[4rem]" style={HEADLINE_FONT}>
          <TwoTone title={title} />
        </h1>
        {text ? <p {...textOv} className="mt-5 max-w-xl text-[16px] leading-7 text-white/80 md:text-[18px]">{text}</p> : null}
      </div>
    </section>
  );
}
