import Image from "next/image";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

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
export function SectionHeading({ eyebrow, title, children, align = "left", className }: { eyebrow?: string; title: string; children?: React.ReactNode; align?: "left" | "center"; className?: string }) {
  return (
    <div className={cn("lp-reveal max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="text-sm font-medium text-lp-primary">{eyebrow}</p> : null}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-lp-heading sm:text-4xl sm:leading-[1.15]">{title}</h2>
      {children ? <p className="mt-4 text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">{children}</p> : null}
    </div>
  );
}

type Variant = "primary" | "secondary" | "light";
const BUTTON: Record<Variant, string> = {
  primary: "bg-lp-primary text-white hover:bg-lp-primary-hover",
  secondary: "border border-lp-border bg-white text-lp-heading hover:bg-lp-soft",
  light: "bg-white text-lp-heading hover:bg-lp-soft",
};
/** Class names for landing buttons rendered as plain anchors. */
export const lpButton = (variant: Variant = "primary", className?: string) =>
  cn(
    "group/btn inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium whitespace-nowrap transition-[background-color,transform,box-shadow] duration-200 outline-none hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-0.5 motion-reduce:[&_svg]:transition-none",
    BUTTON[variant],
    className,
  );

/** WNR + StoreForge brand lock-up. The mark is the same shelf-bars glyph used in the product. */
export function BrandLogo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7 shrink-0">
        <rect width="32" height="32" rx="8" className={light ? "fill-white" : "fill-lp-primary"} />
        <rect x="8" y="9" width="16" height="3.5" rx="1.75" className={light ? "fill-lp-primary" : "fill-white"} />
        <rect x="8" y="14.25" width="12" height="3.5" rx="1.75" className={light ? "fill-lp-primary" : "fill-white"} />
        <rect x="8" y="19.5" width="8" height="3.5" rx="1.75" className={light ? "fill-lp-primary" : "fill-white"} />
      </svg>
      <span className="flex flex-col leading-none">
        <span className={cn("text-[17px] font-semibold tracking-tight", light ? "text-white" : "text-lp-heading")}>{APP_NAME}</span>
        <span className={cn("mt-1 text-[10px] font-medium tracking-[0.14em]", light ? "text-white/70" : "text-lp-text")}>BY WNR</span>
      </span>
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
