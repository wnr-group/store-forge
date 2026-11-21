import Image from "next/image";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { ImagePlaceholder, resolveImage } from "../../ui";
import { SHELL } from "./shell";
import type { SectionProps } from "..";
import { DisplayHeading, Eyebrow } from "./eyebrow";

/**
 * Boutique hero: a rounded panel in the theme's primary colour. The text sits on the left, with live counts from the
 * store as its figures; on the right is the hero picture and, when the store has them, two collection pictures.
 */
export function BoutiqueHero({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const heading = (node.settings?.heading as string) || store.name;
  const subheading = (node.settings?.subheading as string) || store.description || null;
  const { url: heroUrl, alt } = resolveImage(node.settings?.image);
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id]?.type !== "hero-slide");
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const productCount = (store.products ?? []).length;
  const collections = context.collections ?? [];
  const stats = [
    productCount > 0 ? { value: productCount, label: productCount === 1 ? "product" : "products" } : null,
    collections.length > 0 ? { value: collections.length, label: collections.length === 1 ? "collection" : "collections" } : null,
  ].filter((s): s is { value: number; label: string } => s !== null);
  const tiles = collections.filter((c) => c.image_path).slice(0, 2);

  return (
    <section className={cn(SHELL, "pt-4 md:pt-6")} {...sfProps}>
      <div className="grid overflow-hidden rounded-[28px] bg-primary text-primary-foreground lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-center gap-6 px-6 py-10 sm:px-10 md:py-14 lg:px-14 lg:py-16">
          <Eyebrow tone="dark">{store.name}</Eyebrow>
          <DisplayHeading as="h1" tone="dark" className="text-[2.5rem] leading-[1.05] sm:text-5xl lg:text-[3.5rem]">
            {heading}
          </DisplayHeading>
          {subheading ? <p className="max-w-md text-[15px] leading-7 text-pretty text-white/75">{subheading}</p> : null}
          {ids.length > 0 ? (
            <div className="flex flex-wrap gap-3 [&>div]:pt-0 [&_a]:h-12 [&_a]:rounded-full [&_a]:border [&_a]:border-white/35 [&_a]:bg-transparent [&_a]:px-7 [&_a]:text-[14px] [&_a]:font-medium [&_a]:text-white [&_a]:shadow-none [&_a]:transition-colors [&_a]:duration-200 [&_a:hover]:bg-white/10 [&>div:first-child_a]:border-white [&>div:first-child_a]:bg-white [&>div:first-child_a]:text-primary [&>div:first-child_a:hover]:bg-[#e9d6b8]">
              {ids.map((id) => renderBlockComponent(blocks[id], context, id))}
            </div>
          ) : null}
          {stats.length > 0 ? (
            <dl className="mt-2 flex gap-10 border-t border-white/15 pt-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-[2rem] leading-none" style={{ fontFamily: "var(--sf-font-heading)" }}>
                    {s.value}
                    <span className="mt-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60" style={{ fontFamily: "var(--sf-font-body)" }}>
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className={cn("grid gap-3 p-3 sm:p-4 lg:p-5", tiles.length > 0 ? "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : "grid-cols-1")}>
          <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] bg-white/5 lg:aspect-auto lg:min-h-[28rem]">
            {heroUrl ? <Image src={heroUrl} alt={alt} fill priority sizes="(min-width: 1024px) 28vw, 60vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep />}
          </div>
          {tiles.length > 0 ? (
            <div className="grid gap-3">
              {tiles.map((c) => (
                <div key={c.slug} className="relative aspect-[3/4] overflow-hidden rounded-[22px] bg-white/5 lg:aspect-auto">
                  <Image src={publicImageUrl(c.image_path)!} alt={c.name} fill sizes="(min-width: 1024px) 18vw, 30vw" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
