import Image from "next/image";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";

/** Page container shared by every landing section, so everything sits on one grid. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-16 py-16 sm:py-24", className)}>
      {children}
    </section>
  );
}

/** Section label, heading and optional lead paragraph. */
export function SectionHeading({ eyebrow, title, children, align = "left", className, dark = false }: { eyebrow?: string; title: string; children?: React.ReactNode; align?: "left" | "center"; className?: string; dark?: boolean }) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className={cn("inline-flex items-center gap-3 text-sm font-semibold tracking-wide", dark ? "text-lp-accent-light" : "text-lp-primary", align === "center" && "justify-center")}>
          <span aria-hidden className="lp-gold-rule h-px w-8" />
          {eyebrow}
        </p>
      ) : null}
      <h2 className={cn("mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.12]", dark ? "text-white" : "text-lp-heading")}>{title}</h2>
      {children ? <p className={cn("mt-4 text-base leading-7 text-pretty sm:text-lg sm:leading-8", dark ? "text-white/75" : "text-lp-text")}>{children}</p> : null}
    </Reveal>
  );
}

type Variant = "primary" | "secondary" | "light" | "gold";
const BUTTON: Record<Variant, string> = {
  primary: "bg-lp-cta text-lp-deep hover:bg-lp-cta-hover",
  secondary: "border border-lp-border bg-white text-lp-heading hover:bg-lp-soft",
  light: "bg-white text-lp-heading hover:bg-lp-soft",
  gold: "bg-lp-cta text-lp-deep hover:bg-lp-accent",
};
/** Class names for landing buttons rendered as plain anchors. */
export const lpButton = (variant: Variant = "primary", className?: string) =>
  cn(
    "group/btn inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold whitespace-nowrap transition-[background-color,translate,box-shadow] duration-200 outline-none hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-0.5 motion-reduce:[&_svg]:transition-none",
    BUTTON[variant],
    className,
  );

/**
 * Kanova Store brand lock-up, drawn to the proportions of the logo artwork: the K shopping-bag mark is an image
 * (public/kanova-mark.png) and "Kanova", the TM and "Store" are live SVG text, each fitted to the width it has in the artwork.
 * Coordinates are the artwork's own pixels (origin at the mark's top left, 282 high). An uploaded platform logo is shown with
 * the platform name beside it instead.
 */
const BRAND_FONT = "var(--font-manrope), ui-sans-serif, system-ui, sans-serif";
export function BrandLogo({ className, light = false, name = APP_NAME, logoUrl }: { className?: string; light?: boolean; name?: string; logoUrl?: string | null }) {
  if (!logoUrl) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg viewBox="0 0 894 282" aria-hidden focusable="false" className={cn("w-auto shrink-0", light ? "h-16 text-white" : "h-[3.25rem] text-lp-heading")}>
          <defs>
            <linearGradient id={light ? "kn-dash-light" : "kn-dash"} x1="0" x2="1">
              <stop offset="0" stopColor="#f86f18" />
              <stop offset="1" stopColor="#fa9c2c" />
            </linearGradient>
          </defs>
          <image href="/kanova-mark.png" x="0" y="1.5" width="230" height="279" />
          <g fill="currentColor" style={{ fontFamily: BRAND_FONT }}>
            <text x="285" y="191" fontSize="158" fontWeight="800" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" textLength="541" lengthAdjust="spacingAndGlyphs">Kanova</text>
            <text x="834" y="120" fontSize="46" fontWeight="700" textLength="54" lengthAdjust="spacingAndGlyphs">TM</text>
            <text x="415" y="265" fontSize="63" fontWeight="500" textLength="245" lengthAdjust="spacingAndGlyphs">Store</text>
          </g>
          <rect x="285" y="230" width="108" height="11" rx="5.5" fill={`url(#${light ? "kn-dash-light" : "kn-dash"})`} />
        </svg>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src={logoUrl} alt="" aria-hidden width={160} height={48} unoptimized className="h-8 w-auto max-w-40 shrink-0 object-contain" />
      <span className={cn("lp-display text-[19px] leading-none font-extrabold tracking-tight", light ? "text-white" : "text-lp-heading")}>{name}</span>
    </span>
  );
}

type PhotoProps = { src: string; alt: string; width: number; height: number; sizes: string; priority?: boolean; className?: string; imgClassName?: string; caption?: string; objectPosition?: string; style?: React.CSSProperties };

/**
 * A photograph with a consistent radius and border. The image slowly scales on hover (not for reduced-motion users).
 * Width and height are the file's own, so the layout never shifts while it loads.
 */
export function Photo({ src, alt, width, height, sizes, priority, className, imgClassName, caption, objectPosition, style }: PhotoProps) {
  return (
    <figure style={style} className={cn("group relative overflow-hidden rounded-xl border border-lp-border bg-lp-soft", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        style={objectPosition ? { objectPosition } : undefined}
        className={cn("h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]", imgClassName)}
      />
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pt-10 pb-3 text-sm font-medium text-white">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
