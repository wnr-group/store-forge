import "server-only";
import { getProductApi, listProductsApi } from "@/lib/api/endpoints/product-api";
import { getPublicProductApi } from "@/lib/api/endpoints/public-api";
import {
  getPresentationApi,
  listPresentationsApi,
  publishPresentationApi,
  resetPresentationApi,
  savePresentationDraftApi,
} from "@/lib/api/endpoints/presentation-api";
import { getStoreApi } from "@/lib/api/endpoints/store-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";
import { isEmptyPresentation, parsePresentation } from "@/lib/templates/product-presentation";
import { toProductResource } from "@/services/storefront.service";
import type { PickerPage, PresentationSummary, ProductPreview } from "@/lib/themes/types";

/**
 * Per-product presentation for the Customize editor. Reading needs `design:view`, saving drafts `design:edit`,
 * publishing and resetting `design:publish` (checked here, again by the API and the database). The workspace comes
 * from the verified membership, never from the browser.
 */

const LIST_PAGE = 100;
/** Cap on the pages of customized products read for the status chips (100 each): the picker stays usable for any store. */
const MAX_LIST_PAGES = 10;

/**
 * Every customized product with its state (only products that have settings are listed), paged 100 at a time. `truncated`
 * is true when the store has more than the pages read: the rest are not in the list, and the editor says so rather than
 * counting as if the list were complete.
 */
export async function listPresentations(): Promise<{ items: PresentationSummary[]; truncated: boolean }> {
  const { tenant } = await requireActiveTenant("design:view");
  const all: PresentationSummary[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const { items, meta } = await listPresentationsApi(tenant.id, { page, limit: LIST_PAGE });
    all.push(...items);
    if (page >= meta.totalPages) break;
    if (page === MAX_LIST_PAGES) truncated = true;
  }
  return { items: all, truncated };
}

export async function getPresentation(productId: string) {
  const { tenant } = await requireActiveTenant("design:view");
  return getPresentationApi(tenant.id, productId);
}

export async function savePresentationDraft(productId: string, document: unknown, expectedRevision: number) {
  const { tenant } = await requireActiveTenant("design:edit");
  return savePresentationDraftApi(tenant.id, productId, document, expectedRevision);
}

export async function publishPresentation(productId: string, expectedRevision?: number) {
  const { tenant } = await requireActiveTenant("design:publish");
  return publishPresentationApi(tenant.id, productId, expectedRevision);
}

export async function resetPresentation(productId: string) {
  const { tenant } = await requireActiveTenant("design:publish");
  return resetPresentationApi(tenant.id, productId);
}

const PICKER_PAGE = 20;

/** The picker's products: the store's active products from the existing admin list (the API's list of customized products has ids only). */
export async function listPickerProducts(q: { page: number; search?: string }): Promise<PickerPage> {
  const { tenant } = await requireActiveTenant("design:view");
  const { items, meta } = await listProductsApi(tenant.id, { page: q.page, limit: PICKER_PAGE, search: q.search || undefined, status: "active", sortBy: "createdAt", sortOrder: "desc" });
  return {
    items: items.map((p) => ({ id: p.id, name: p.name, slug: p.slug, imagePath: p.imagePath })),
    page: meta.page,
    totalPages: meta.totalPages,
    total: meta.total,
  };
}

/** Finds a product's id from its slug in the admin list (the public endpoints carry no ids). Active products only, like the preview. */
async function findProductId(tenantId: string, slug: string): Promise<string | null> {
  const wanted = slug.toLowerCase();
  // The slug is built from the name, so a search by its words usually finds it at once; otherwise read on page by page.
  const guess = await listProductsApi(tenantId, { page: 1, limit: 50, search: slug.replace(/-/g, " "), status: "active" });
  const hit = guess.items.find((p) => p.slug.toLowerCase() === wanted);
  if (hit) return hit.id;
  for (let page = 1; page <= 6; page += 1) {
    const { items, meta } = await listProductsApi(tenantId, { page, limit: 50, status: "active", sortBy: "createdAt", sortOrder: "desc" });
    const found = items.find((p) => p.slug.toLowerCase() === wanted);
    if (found) return found.id;
    if (page >= meta.totalPages) break;
  }
  return null;
}

/**
 * One product for the editor's product-page preview: the product exactly as the storefront renders it, plus its design
 * settings. Give the id (a deep link or a pick from the picker) or the slug (the preview's default first product).
 * The store slug comes from the API for the verified workspace, never from the browser. A product that is not active is not
 * on the storefront and cannot be previewed. A problem reading the settings (for example an API that does not have the
 * feature yet) is reported in `presentationError` and does not stop the preview.
 */
export async function loadProductPreview(target: { productId?: string; slug?: string }): Promise<ProductPreview> {
  const { tenant } = await requireActiveTenant("design:view");
  let productId = target.productId;
  let slug = target.slug;
  if (productId) {
    const product = await getProductApi(tenant.id, productId);
    slug = product.slug;
  } else if (slug) {
    productId = (await findProductId(tenant.id, slug)) ?? undefined;
    if (!productId) throw new AppError("NOT_FOUND", "That product could not be found.");
  } else {
    throw new AppError("VALIDATION", "Choose a product to preview.");
  }
  const store = await getStoreApi(tenant.id);
  const publicProduct = await getPublicProductApi(store.slug, slug!).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") throw new AppError("NOT_FOUND", "This product is not visible on your store, so it cannot be previewed. Make sure it is active.");
    throw error;
  });
  const [presentation] = await Promise.all([getPresentationApi(tenant.id, productId).then((p) => ({ ok: true as const, p }), (e: unknown) => ({ ok: false as const, e }))]);
  return {
    productId,
    slug: slug!,
    name: publicProduct.product.name,
    resource: toProductResource(publicProduct),
    presentation: presentation.ok ? presentation.p : null,
    presentationError: presentation.ok ? null : presentation.e instanceof AppError ? presentation.e.message : "Product design settings are not available right now.",
  };
}

/** Ids per call: the same number the action accepts. */
const CHECK_CHUNK = 50;
/** Reads in flight at once within a call, so a chunk does not open fifty requests together. */
const CHECK_CONCURRENCY = 10;

/**
 * The list of customized products has states only. A never-published row can be an empty draft (every setting reverted):
 * the API ignores it when publishing, so it must not be shown as waiting to go live. This reads those products and sorts
 * them into `empty` (never published, no settings) and `real` (never published, has settings). A product that cannot be
 * read, was published meanwhile, or uses an unsupported version is in neither list, so the caller never guesses.
 */
export async function checkDrafts(ids: string[]): Promise<{ empty: string[]; real: string[] }> {
  const { tenant } = await requireActiveTenant("design:view");
  const unique = [...new Set(ids)].slice(0, CHECK_CHUNK);
  const empty: string[] = [];
  const real: string[] = [];
  for (let i = 0; i < unique.length; i += CHECK_CONCURRENCY) {
    const part = unique.slice(i, i + CHECK_CONCURRENCY);
    const results = await Promise.allSettled(part.map((id) => getPresentationApi(tenant.id, id)));
    results.forEach((r, j) => {
      if (r.status !== "fulfilled" || r.value.publishedDocument !== null || parsePresentation(r.value.document) === null) return;
      (isEmptyPresentation(r.value.document) ? empty : real).push(part[j]);
    });
  }
  return { empty, real };
}
