import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { readCollectionCardParts } from "@/lib/templates/card-parts";
import { ImagePlaceholder, SECTION_Y } from "../../ui";
import { SHELL } from "./shell";
import type { SectionProps } from "..";
import { DisplayHeading, Eyebrow } from "./eyebrow";

const GRID: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

/** Boutique "shop by category": rounded 4:5 picture tiles with the name and count beneath. */
export function BoutiqueCollectionList({ node, context, sectionId }: SectionProps) {
  const title = (node.settings?.title as string) ?? "Collections";
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const columns = Math.min(6, Math.max(2, (node.settings?.columns as number) ?? 6));
  const parts = readCollectionCardParts(node.settings, true);
  const showCount = parts.count;
  const collections = context.collections ?? [];
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (collections.length === 0 && !isPreview) return null;

  return (
    <section className={cn(SHELL, SECTION_Y)} {...sfProps}>
      <div className="mb-8 space-y-3 md:mb-10">
        <Eyebrow>{eyebrow}</Eyebrow>
        <DisplayHeading>{title}</DisplayHeading>
      </div>
      {collections.length === 0 ? (
        <p className="border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Create collections and they appear here.</p>
      ) : (
        <ul className={cn("grid gap-x-3 gap-y-6 sm:gap-x-5", GRID[Math.min(columns, Math.max(2, collections.length))] ?? GRID[6])}>
          {collections.map((col, i) => {
            const img = publicImageUrl(col.image_path);
            return (
              <li key={col.slug || col.id} className="min-w-0">
                <Link href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id} className="group block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.375rem] bg-muted">
                    {img && parts.image ? (
                      <Image src={img} alt="" fill priority={i < 3} sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.05] motion-reduce:transition-none" />
                    ) : (
                      <ImagePlaceholder className="absolute inset-0" />
                    )}
                  </div>
                  <div className="mt-3 px-1">
                    {parts.title ? (
                      <h3 className="text-lg leading-tight tracking-[-0.01em] text-foreground" style={{ fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" }}>
                        {col.name}
                      </h3>
                    ) : null}
                    {showCount && typeof col.product_count === "number" ? (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {col.product_count} {col.product_count === 1 ? "piece" : "pieces"}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
