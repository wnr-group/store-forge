import "server-only";
import { listCollectionsApi } from "@/lib/api/endpoints/collection-api";
import { listProductsApi } from "@/lib/api/endpoints/product-api";
import { getStoreApi } from "@/lib/api/endpoints/store-api";
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
import { requireActiveTenant } from "@/lib/tenant/context";
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
export async function getPreviewStoreData(): Promise<PreviewStoreData> {
  const { tenant } = await requireActiveTenant();
  const [store, products, collections] = await Promise.all([
    getStoreApi(tenant.id),
    listProductsApi(tenant.id, { page: 1, limit: 24, status: "active", sortBy: "createdAt", sortOrder: "desc" }),
    listCollectionsApi(tenant.id),
  ]);
  return {
    store: {
      name: store.name,
      slug: store.slug,
      description: store.description,
      logo_path: store.logoPath,
      currency: store.currency,
      products: products.items.map((p) => ({
        name: p.name,
        slug: p.slug,
        short_description: null,
        price_minor: p.priceMinor,
        compare_at_price_minor: null,
        image_path: p.imagePath,
      })),
    },
    collections: collections
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, image_path: c.imagePath, product_count: c.productCount })),
  };
}
