import { cn } from "@/lib/utils";

/** The small, tracked, uppercase label that sits above Boutique headings. */
export function Eyebrow({ children, tone = "light", dot = false, className }: { children: React.ReactNode; tone?: "light" | "dark"; dot?: boolean; className?: string }) {
  if (!children) return null;
  return (
    <p className={cn("flex items-center text-[11px] font-medium uppercase tracking-[0.2em]", tone === "dark" ? "text-accent" : "text-foreground/70", className)}>
      {dot ? <span aria-hidden className="mr-2.5 size-1.5 shrink-0 rounded-full bg-accent" /> : null}
      {children}
    </p>
  );
}

/** Display-face heading used by every Boutique section. */
export function DisplayHeading({ children, as: Tag = "h2", tone = "light", className }: { children: React.ReactNode; as?: "h1" | "h2" | "h3"; tone?: "light" | "dark"; className?: string }) {
  return (
    <Tag className={cn("text-balance text-[2rem] leading-[1.08] tracking-[-0.01em] md:text-[2.5rem]", tone === "dark" ? "text-white" : "text-foreground", className)} style={{ fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" }}>
      {children}
    </Tag>
  );
}
