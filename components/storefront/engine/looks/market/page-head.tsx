import { cn } from "@/lib/utils";
import { Breadcrumbs, WRAP } from "./ui";

/** The top of a listing page: breadcrumbs, the page title and a short line under it (the collection's description). */
export function MarketPageHead({ title, text, crumbs, sfProps }: { title: string; text?: string; crumbs: { label: string; href?: string }[]; sfProps?: Record<string, string> }) {
  return (
    <section className={cn(WRAP, "pt-4")} {...sfProps}>
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-xl font-bold leading-tight text-primary sm:text-[22px]">{title}</h1>
      {text ? <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{text}</p> : null}
    </section>
  );
}
