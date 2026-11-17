import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** The engine's own container (page width and gutters from the theme), so Sport sections line up with the footer. */
export const SHELL = "mx-auto w-full max-w-[var(--sf-page-width,80rem)] px-4 sm:px-6 lg:px-8";
export const BAND_Y = "py-14 md:py-20 lg:py-24";

export const HEADLINE_FONT = { fontFamily: "var(--sf-font-heading)" } as const;

/** Section title: heavy, tight, capitals, optionally slanted, with a short accent bar underneath. */
export function SportTitle({ children, italic = true, bar = true, tone = "dark", as: Tag = "h2", className }: { children: React.ReactNode; italic?: boolean; bar?: boolean; tone?: "dark" | "light"; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <div className={className}>
      <Tag className={cn("text-balance text-[2rem] font-extrabold uppercase leading-[1] tracking-[-0.025em] md:text-[2.5rem] xl:text-[3rem]", italic && "italic", tone === "dark" ? "text-primary" : "text-white")} style={HEADLINE_FONT}>
        {children}
      </Tag>
      {bar ? <span aria-hidden className="mt-5 block h-1 w-[70px] rounded-full bg-accent" /> : null}
    </div>
  );
}

/** Small label with a dot, in capitals. */
export function SportEyebrow({ children, tone = "dark", className }: { children: React.ReactNode; tone?: "dark" | "light"; className?: string }) {
  if (!children) return null;
  return (
    <p className={cn("flex items-center text-[12px] font-bold uppercase tracking-[0.16em]", tone === "dark" ? "text-secondary" : "text-white/90", className)}>
      <span aria-hidden className="mr-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
      {children}
    </p>
  );
}

/** "View all" link with an arrow, for the right of a section title. */
export function ViewAll({ href, children = "View all", tone = "dark" }: { href: string; children?: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className={cn("group/va inline-flex items-center gap-2 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary", tone === "dark" ? "text-primary hover:text-secondary" : "text-white hover:text-accent")}>
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 group-hover/va:translate-x-0.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}

const PILL = "inline-flex items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
export const PILL_DARK = cn(PILL, "h-14 bg-primary px-7 text-primary-foreground hover:bg-[var(--primary-hover,var(--primary))] focus-visible:outline-primary");
export const PILL_YELLOW = cn(PILL, "h-14 bg-accent px-8 text-primary shadow-[0_10px_30px_-10px_rgba(251,200,38,0.7)] hover:brightness-95 focus-visible:outline-accent");
export const PILL_OUTLINE = cn(PILL, "h-12 border border-border bg-background px-6 text-primary hover:border-primary focus-visible:outline-primary");
export const PILL_GHOST = cn(PILL, "h-14 border border-white/30 bg-white/10 px-7 text-white backdrop-blur-sm hover:bg-white/20 focus-visible:outline-white");

/** Splits heading text on {{ }}: the wrapped part gets `className` (a coloured run in a headline). */
export function Highlighted({ text, className }: { text: string; className: string }) {
  const parts = text.split(/(\{\{[^}]*\}\})/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => (part.startsWith("{{") && part.endsWith("}}") ? <span key={i} className={className}>{part.slice(2, -2)}</span> : <span key={i}>{part}</span>))}
    </>
  );
}
