import "server-only";
import { listCollectionsApi } from "@/lib/api/endpoints/collection-api";
import { listProductsApi } from "@/lib/api/endpoints/product-api";
import { getStoreApi } from "@/lib/api/endpoints/store-api";
import { listPagesApi } from "@/lib/api/endpoints/pages-api";
import {
  applyThemeApi,
  getCurrentThemeApi,
  getPreviewApi,
  getTemplateApi,
  getThemeApi,
  listTemplatesApi,
  listThemesApi,
  listVersionsApi,
  publishTemplateApi,
  publishThemeApi,
  rollbackApi,
  saveDraftApi,
} from "@/lib/api/endpoints/theme-api";
import { getPublicCollectionApi, getPublicCollectionsApi, getPublicProductApi, getStorefrontApi } from "@/lib/api/endpoints/public-api";
import { requireActiveTenant } from "@/lib/tenant/context";
import { toProductResource } from "@/services/storefront.service";
import type { PreviewStoreData, ThemeIndustry } from "@/lib/themes/types";

/**
 * The Theme Store and the visual editor's data, from the StoreForge API. Reading is open to every member of the active
 * workspace; changing anything needs `store:manage` (checked here and again by the API and the database). The workspace
 * comes from the verified membership, never from the browser.
 */

export type ThemeQuery = { page: number; limit: number; search?: string; industry?: ThemeIndustry };

export async function getThemes(q: ThemeQuery) {
  const { tenant } = await requireActiveTenant();
  return listThemesApi(tenant.id, { page: q.page, limit: q.limit, search: q.search, industry: q.industry, sortOrder: "asc" });
}

export async function getThemeDetail(slug: string) {
  const { tenant } = await requireActiveTenant();
  return getThemeApi(tenant.id, slug);
}

export async function getCurrentTheme() {
  const { tenant } = await requireActiveTenant();
  return getCurrentThemeApi(tenant.id);
}

export async function applyTheme(slug: string) {
  const { tenant } = await requireActiveTenant("store:manage");
  return applyThemeApi(tenant.id, slug);
}

export async function listTemplates() {
  const { tenant } = await requireActiveTenant();
  return listTemplatesApi(tenant.id);
}

export async function getTemplate(id: string) {
  const { tenant } = await requireActiveTenant();
  return getTemplateApi(tenant.id, id);
}

export async function getPreview(id: string) {
  const { tenant } = await requireActiveTenant();
  return getPreviewApi(tenant.id, id);
}

export async function saveDraft(id: string, document: unknown, expectedRevision: number) {
  const { tenant } = await requireActiveTenant("store:manage");
  return saveDraftApi(tenant.id, id, document, expectedRevision);
}

export async function publishTheme(label?: string) {
  const { tenant } = await requireActiveTenant("store:manage");
  return publishThemeApi(tenant.id, label);
}

export async function publishTemplate(id: string, expectedRevision?: number, label?: string) {
  const { tenant } = await requireActiveTenant("store:manage");
  return publishTemplateApi(tenant.id, id, expectedRevision, label);
}

export async function getVersions(id: string) {
  const { tenant } = await requireActiveTenant();
  return listVersionsApi(tenant.id, id);
}

export async function rollbackTemplate(id: string, versionId: string) {
  const { tenant } = await requireActiveTenant("store:manage");
  return rollbackApi(tenant.id, id, versionId);
}

/** The merchant's own store, products and collections in the shapes the storefront renderer takes, so the preview shows real data. */
/** Cap on collections whose products the editor preloads, so a store with many collections cannot make the page fan out. */
const PRELOADED_COLLECTIONS = 12;

type PreviewOptions = {
  /** Also load each active collection's products, for "Featured collection" sections in the editor. */
  collectionProducts?: boolean;
  /** Also load the first product as a product page shows it, for the editor's product-page preview. */
  productPage?: boolean;
  /** Also load the published content pages (About, Contact ...). */
  contentPages?: boolean;
};

/**
 * The store's real catalogue for the theme previews, read from the SAME public endpoints the live storefront uses, so
 * "Your store" in a preview shows exactly what shoppers see: active products only, with description, sale price and
 * pictures. The tenant comes from the verified workspace; the store slug from the API, never from the browser. If the
 * public view is unavailable (for example the store is switched off), it falls back to the merchant's own active products.
 */
export async function getPreviewStoreData(options: PreviewOptions = {}): Promise<PreviewStoreData> {
  const { tenant } = await requireActiveTenant();
  const store = await getStoreApi(tenant.id);
  const [live, liveCollections] = await Promise.all([getStorefrontApi(store.slug).catch(() => null), getPublicCollectionsApi(store.slug).catch(() => null)]);

  const products = live
    ? live.products.map((p) => ({
        name: p.name,
        slug: p.slug,
        short_description: p.shortDescription,
        price_minor: p.priceMinor,
        compare_at_price_minor: p.compareAtPriceMinor,
        image_path: p.imagePath,
      }))
    : (await listProductsApi(tenant.id, { page: 1, limit: 48, status: "active", sortBy: "createdAt", sortOrder: "desc" })).items.map((p) => ({
        name: p.name,
        slug: p.slug,
        short_description: null,
        price_minor: p.priceMinor,
        compare_at_price_minor: null,
        image_path: p.imagePath,
      }));

  const collections = liveCollections
    ? liveCollections
    : (await listCollectionsApi(tenant.id)).filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, image_path: c.imagePath, product_count: c.productCount }));

  const [collectionProducts, productPage] = await Promise.all([
    options.collectionProducts && live
      ? Promise.all(collections.slice(0, PRELOADED_COLLECTIONS).map(async (c) => [c.slug, await getPublicCollectionApi(store.slug, c.slug).then((r) => r.products, () => null)] as const)).then((rows) => {
          const out: NonNullable<PreviewStoreData["collectionProducts"]> = {};
          for (const [slug, list] of rows) if (list) out[slug] = list;
          return out;
        })
      : undefined,
    options.productPage && live && products[0] ? getPublicProductApi(store.slug, products[0].slug).then(toProductResource, () => null) : null,
  ]);

  const contentPages = options.contentPages
    ? await listPagesApi(tenant.id).then((rows) => rows.filter((r) => r.status === "published").map((r) => ({ title: r.title, slug: r.slug, body: r.body })), () => [])
    : undefined;

  return {
    store: { name: store.name, slug: store.slug, description: store.description, logo_path: store.logoPath, currency: store.currency, products },
    collections,
    collectionProducts,
    productPage,
    contentPages,
  };
}

/** One product as its page shows it (pictures, options, variants), for the editor's product-page preview. */
export async function getPreviewProduct(slug: string): Promise<Record<string, unknown> | null> {
  const { tenant } = await requireActiveTenant();
  const store = await getStoreApi(tenant.id);
  return getPublicProductApi(store.slug, slug).then(toProductResource, () => null);
}

/** The active products of one collection, for the editor's collection-page preview. */
export async function getPreviewCollectionProducts(slug: string): Promise<PreviewStoreData["store"]["products"] | null> {
  const { tenant } = await requireActiveTenant();
  const store = await getStoreApi(tenant.id);
  return getPublicCollectionApi(store.slug, slug).then((r) => r.products, () => null);
}
