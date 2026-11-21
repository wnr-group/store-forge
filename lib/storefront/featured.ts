import type { TemplateDocument } from "@/lib/templates/document";

/**
 * "Featured collection" sections name a collection by its address (slug) or id. The storefront needs those collections'
 * products, so this finds which collections a page refers to. It reads the document only: no data, no network.
 */

/** Cap on collections fetched for one page, so a crafted document cannot make the server fan out. */
export const MAX_FEATURED_COLLECTIONS = 12;

type CollectionRef = { id: string; slug: string };

/** The slugs of the collections the page's featured sections point at, once each, in page order. */
export function featuredCollectionSlugs(docs: (TemplateDocument | null | undefined)[], collections: CollectionRef[]): string[] {
  const bySlug = new Map(collections.map((c) => [c.slug, c.slug]));
  const byId = new Map(collections.map((c) => [c.id, c.slug]));
  const out: string[] = [];
  for (const doc of docs) {
    if (!doc) continue;
    const order = doc.order ?? Object.keys(doc.sections ?? {});
    for (const id of order) {
      const section = doc.sections?.[id];
      if (!section || section.type !== "featured-collection" || section.disabled) continue;
      const ref = String(section.settings?.collectionId ?? "").trim();
      const slug = ref ? (bySlug.get(ref) ?? byId.get(ref)) : undefined;
      if (slug && !out.includes(slug)) out.push(slug);
    }
  }
  return out.slice(0, MAX_FEATURED_COLLECTIONS);
}

/** Looks a section's `collectionId` up among the collections that exist (by slug or id). */
export function resolveCollection<T extends CollectionRef>(ref: unknown, collections: T[] | undefined): T | undefined {
  const value = typeof ref === "string" ? ref.trim() : "";
  if (!value) return undefined;
  return collections?.find((c) => c.slug === value || c.id === value);
}

/**
 * What the editor's collection select must show for a stored `collectionId`. New choices store the collection's id; older
 * documents hold its slug. Both resolve to the same collection, so the select is keyed by id and a legacy slug still shows
 * as chosen. A reference that matches nothing is kept as typed so the editor can flag it as a removed collection.
 */
export function collectionSelectValue(ref: unknown, collections: CollectionRef[] | undefined): { value: string; known: boolean } {
  const match = resolveCollection(ref, collections);
  if (match) return { value: match.id, known: true };
  const text = typeof ref === "string" ? ref.trim() : "";
  return { value: text, known: text === "" };
}
