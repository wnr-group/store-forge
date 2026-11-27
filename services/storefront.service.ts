import "server-only";
import { cache } from "react";
import { z } from "zod";
import {
  getPublicCollectionApi,
  getPublicCollectionsApi,
  getPublicLayoutApi,
  getPublicLayoutForApi,
  getPublicPageApi,
  getPublicPagesApi,
  getPublicProductApi,
  getStorefrontApi,
  type PublicCollectionApi,
  type PublicProductApi,
  type PublicLayoutApi,
  type PublicPageApi,
  type PublicPageLinkApi,
} from "@/lib/api/endpoints/public-api";
import { getPublicCatalogNodeApi, getPublicCatalogTreeApi } from "@/lib/api/endpoints/public-catalog-api";
import type { PublicCatalogSort } from "@/lib/catalog/public-types";
import { AppError } from "@/lib/errors";
import { CATALOG_PAGE_SIZE, catalogSegments, nodeRenderData, rootRenderData, type CatalogRenderData } from "@/lib/storefront/catalog";
import type { CollectionProductSummary } from "@/components/storefront/engine/types";
import { featuredCollectionSlugs } from "@/lib/storefront/featured";
import { faviconUrlFromTheme } from "@/lib/storefront/seo";
import type { TemplateDocument } from "@/lib/templates/document";
import { parsePresentation } from "@/lib/templates/product-presentation";

const templateSchema = z.object({
  key: z.string(),
  accent_color: z.string().nullable(),
  hero_heading: z.string().nullable(),
  hero_subheading: z.string().nullable(),
  hero_image_path: z.string().nullable(),
});

/** `template` is optional and nullable so a store with no settings, or a database not yet migrated, still renders the default. */
export const storefrontSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logo_path: z.string().nullable(),
  /** Home page SEO text. Optional so an API that predates it still parses. */
  meta_title: z.string().nullish(),
  meta_description: z.string().nullish(),
  currency: z.string(),
  products: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      short_description: z.string().nullable(),
      price_minor: z.number(),
      compare_at_price_minor: z.number().nullable(),
      image_path: z.string().nullable(),
    }),
  ),
  template: templateSchema.nullish(),
});

export type PublicStorefront = z.infer<typeof storefrontSchema>;

/**
 * Public data for <slug>.<root domain>, from `GET /public/storefronts/:slug` of the StoreForge API. No session is involved
 * and none is trusted: the slug comes from the Host header, and the API returns only public fields of an active store in
 * an active company. Unknown, inactive and suspended stores all answer 404, which is "no store". Memoized per request:
 * generateMetadata and the page both ask for the same store, which should cost one API call, not two.
 */
export const getPublicStorefront = cache(async (slug: string): Promise<PublicStorefront | null> => {
  try {
    const s = await getStorefrontApi(slug);
    return storefrontSchema.parse({
      name: s.name,
      slug: s.slug,
      description: s.description,
      logo_path: s.logoPath,
      meta_title: s.metaTitle ?? null,
      meta_description: s.metaDescription ?? null,
      currency: s.currency,
      products: s.products.map((p) => ({
        name: p.name,
        slug: p.slug,
        short_description: p.shortDescription,
        price_minor: p.priceMinor,
        compare_at_price_minor: p.compareAtPriceMinor,
        image_path: p.imagePath,
      })),
      template: s.template,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
});

/**
 * The tab icon URL of a store: the favicon of its PUBLISHED theme (Studio > Brand), or null. Read from the layout endpoint on its own,
 * not through getPublishedDesign, because that returns null for a store without a published page even when a theme is published.
 * Memoized per request, and a failure just means "no favicon" (the platform icon stays); it must never break a page.
 */
export const getStorefrontFavicon = cache(async (slug: string): Promise<string | null> => {
  try {
    return faviconUrlFromTheme((await getPublicLayoutApi(slug, "index")).theme);
  } catch {
    return null;
  }
});

/** What the engine renders for a store: its published page, theme and groups, plus its collections. */
export type PublishedDesign = {
  layout: PublicLayoutApi & { template: NonNullable<PublicLayoutApi["template"]> };
  collections: PublicCollectionApi[];
  /** Products of the collections the page features, by collection slug: this store's own active products only. */
  collectionProducts: Record<string, CollectionProductSummary[]>;
};

/**
 * The active products of every collection a page features, fetched once per distinct collection and in parallel (never one
 * call per section or per product). The API resolves each collection inside the store named by `slug`, so another store's
 * products cannot come back. A collection that cannot be read is simply absent: its section shows an empty state.
 */
export async function loadCollectionProducts(slug: string, docs: (TemplateDocument | null | undefined)[], collections: PublicCollectionApi[]): Promise<Record<string, CollectionProductSummary[]>> {
  const wanted = featuredCollectionSlugs(docs, collections);
  const loaded = await Promise.all(wanted.map(async (collectionSlug) => ({ collectionSlug, products: await getPublicCollectionApi(slug, collectionSlug).then((c) => c.products as CollectionProductSummary[], () => null) })));
  const result: Record<string, CollectionProductSummary[]> = {};
  for (const { collectionSlug, products } of loaded) if (products) result[collectionSlug] = products;
  return result;
}

/**
 * The store's PUBLISHED design, or null when it has not published one (the storefront then shows its built-in
 * template). Only published work comes back from the API, so a draft can never reach a shopper. A failure here must not
 * take the store down: it is treated as "no published design" and the built-in template renders.
 */
export const getPublishedDesign = cache(async (slug: string): Promise<PublishedDesign | null> => {
  try {
    const layout = await getPublicLayoutApi(slug, "index");
    if (!layout.template?.document) return null;
    const collections = await getPublicCollectionsApi(slug).catch(() => []);
    const collectionProducts = await loadCollectionProducts(slug, [layout.template.document as unknown as TemplateDocument], collections);
    return { layout: layout as PublishedDesign["layout"], collections, collectionProducts };
  } catch {
    return null;
  }
});

type PageKind = "product" | "collection";

/** The pieces the engine needs to render one resource page. */
export type PublishedResourcePage = {
  layout: PublicLayoutApi & { template: NonNullable<PublicLayoutApi["template"]> };
  collections: PublicCollectionApi[];
  collectionProducts: Record<string, CollectionProductSummary[]>;
  resource: Record<string, unknown>;
  store: PublicStorefront;
};

const notFoundToNull = async <T,>(run: () => Promise<T>): Promise<T | null> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
};

/** The published design for a product or collection page. Null when the store has not published one: the page then does not exist. */
const getResourceLayout = cache(async (slug: string, kind: PageKind, resource: string) => {
  try {
    const layout = await getPublicLayoutForApi(slug, kind, resource);
    return layout.template?.document ? (layout as PublishedResourcePage["layout"]) : null;
  } catch {
    return null;
  }
});

/** A public product as the engine's product blocks read it (pictures, options, variants, related products). */
export function toProductResource(data: PublicProductApi): Record<string, unknown> {
  const imagePathById = new Map(data.images.map((i) => [i.id, i.path]));
  return {
    name: data.product.name,
    slug: data.product.slug,
    // The product description block shows this field; the full description beats the short one.
    short_description: data.product.description ?? data.product.short_description,
    price_minor: data.product.price_minor,
    compare_at_price_minor: data.product.compare_at_price_minor,
    available: data.product.available ?? true,
    sku: data.product.sku,
    part_number: data.product.part_number ?? null,
    type: data.product.product_type,
    category: data.product.category_name,
    image_path: data.images[0]?.path ?? null,
    images: data.images.map((i) => i.path),
    options: data.options.map((o) => ({ id: o.name, name: o.name, values: o.values })),
    variants: data.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price_minor: v.price_minor,
      compare_at_price_minor: v.compare_at_price_minor,
      sku: v.sku,
      image_path: v.image_id ? (imagePathById.get(v.image_id) ?? null) : null,
      option_values: v.options ?? {},
    })),
    related: data.related,
    // Published settings of this product only. Parsed defensively: anything unusable is null and the page renders as the
    // store design says, so a bad or newer document can never break a product page.
    presentation: parsePresentation(data.presentation),
  };
}

/** One product page: the product from the API mapped to what the engine's product blocks read, plus the published design. */
export const getPublishedProductPage = cache(async (slug: string, productSlug: string): Promise<PublishedResourcePage | null> => {
  const [data, layout, collections, store] = await Promise.all([
    notFoundToNull(() => getPublicProductApi(slug, productSlug)),
    getResourceLayout(slug, "product", productSlug),
    getPublicCollectionsApi(slug).catch(() => []),
    getPublicStorefront(slug),
  ]);
  if (!data || !layout || !store) return null;
  const collectionProducts = await loadCollectionProducts(slug, [layout.template.document as unknown as TemplateDocument], collections);
  return {
    layout,
    collections,
    collectionProducts,
    store,
    resource: toProductResource(data),
  };
});

/** One collection page: the collection with its active products, plus the published design. */
export const getPublishedCollectionPage = cache(async (slug: string, collectionSlug: string): Promise<PublishedResourcePage | null> => {
  const [data, layout, collections, store] = await Promise.all([
    notFoundToNull(() => getPublicCollectionApi(slug, collectionSlug)),
    getResourceLayout(slug, "collection", collectionSlug),
    getPublicCollectionsApi(slug).catch(() => []),
    getPublicStorefront(slug),
  ]);
  if (!data || !layout || !store) return null;
  const collectionProducts = await loadCollectionProducts(slug, [layout.template.document as unknown as TemplateDocument], collections);
  return { layout, collections, collectionProducts, store, resource: { ...data.collection, products: data.products } };
});

/** Shared frame for pages the engine builds from a small generated document: the store's published header, footer and theme. */
export type PublishedFrame = { layout: PublishedDesign["layout"]; collections: PublicCollectionApi[]; collectionProducts?: Record<string, CollectionProductSummary[]> };

export const getPublishedFrame = async (slug: string): Promise<PublishedFrame | null> => getPublishedDesign(slug);

/** Published content pages: titles for menus. A failure means "no pages", never a broken store. */
export const getPublicPageLinks = cache(async (slug: string): Promise<PublicPageLinkApi[]> => {
  try {
    return await getPublicPagesApi(slug);
  } catch {
    return [];
  }
});

/** One published content page; drafts and unknown pages are null. */
export const getPublicContentPage = cache(async (slug: string, pageSlug: string): Promise<PublicPageApi | null> =>
  notFoundToNull(() => getPublicPageApi(slug, pageSlug)),
);

// ------------------------------------------------------------------------------------------------------------------ catalog hierarchy

/** What the catalog page needs: the store, the published frame (theme, header, footer) and the plain data every template draws. */
export type PublishedCatalogPage = { store: PublicStorefront; frame: { layout: Pick<PublicLayoutApi, "theme" | "groups">; collections: PublicCollectionApi[] }; data: CatalogRenderData };

/**
 * One page of the store's catalog hierarchy: the top of it (`path` empty) or one item. The same data feeds every template; the frame
 * only supplies the store's own theme, header and footer, and falls back to the engine's defaults for a store with no published design,
 * so the catalog works before (and without) any design. Null means "no such page": an unknown store, no published catalog, or an item
 * that does not exist or is not public. Any other failure is thrown, for the page's error state. Memoized per request.
 */
export const getPublishedCatalogPage = cache(async (slug: string, path: string, page: number, sort: PublicCatalogSort, all: boolean): Promise<PublishedCatalogPage | null> => {
  const segments = catalogSegments(path ? path.split("/") : []);
  if (!segments) return null;
  const query = { page, sort, all };
  const [store, published] = await Promise.all([getPublicStorefront(slug), getPublishedFrame(slug)]);
  if (!store) return null;
  const frame: PublishedCatalogPage["frame"] = published ?? { layout: { theme: null, groups: {} }, collections: [] };
  // The top level and the names of the levels: one small, cached read that serves the root and every item.
  const tree = await notFoundToNull(() => getPublicCatalogTreeApi(slug, 1));
  if (!tree?.hierarchy) return null;
  if (segments.length === 0) return { store, frame, data: rootRenderData(tree, query) };
  const node = await notFoundToNull(() => getPublicCatalogNodeApi(slug, segments, { page, limit: CATALOG_PAGE_SIZE, sort, includeDescendants: all }));
  if (!node) return null;
  return { store, frame, data: nodeRenderData(node, tree.levels, query) };
});
