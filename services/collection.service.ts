import "server-only";
import type { Collection } from "@/lib/domain/entities";
import {
  createCollectionApi,
  deleteCollectionApi,
  getCollectionApi,
  listCollectionsApi,
  listProductOptionsApi,
  updateCollectionApi,
  type CollectionApi,
} from "@/lib/api/endpoints/collection-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";
import type { CollectionInput } from "@/lib/validations/catalog";

/**
 * Collections, served by the StoreForge API (`/collections`). The API verifies product ownership and the image path under
 * the storage locks and removes a replaced or deleted image file after the change commits.
 */
export type CollectionRow = Collection & { productCount: number };

const toRow = (c: CollectionApi, tenantId: string): CollectionRow => ({
  ...c,
  tenantId,
  status: c.status as Collection["status"],
  createdAt: new Date(c.createdAt),
  updatedAt: new Date(c.updatedAt),
});

export async function listCollections(): Promise<CollectionRow[]> {
  const { tenant } = await requireActiveTenant();
  return (await listCollectionsApi(tenant.id)).map((c) => toRow(c, tenant.id));
}

export async function getCollection(id: string): Promise<(Collection & { productIds: string[] }) | null> {
  const { tenant } = await requireActiveTenant();
  try {
    const { productIds, ...c } = await getCollectionApi(tenant.id, id);
    return { ...toRow(c, tenant.id), productIds };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

/** Product choices for the collection picker (ids + names only). */
export async function listProductOptions(): Promise<{ id: string; name: string }[]> {
  const { tenant } = await requireActiveTenant();
  return listProductOptionsApi(tenant.id);
}

type Values = ReturnType<typeof import("@/lib/validations/catalog").collectionInputSchema.parse>;

export async function createCollection(id: string, input: Values): Promise<{ id: string }> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  await createCollectionApi(tenant.id, { id, ...input });
  return { id };
}

export async function updateCollection(id: string, input: Values): Promise<void> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  await updateCollectionApi(tenant.id, id, input);
}

export async function deleteCollection(id: string): Promise<void> {
  const { tenant } = await requireActiveTenant("catalog:delete");
  await deleteCollectionApi(tenant.id, id);
}

export type { CollectionInput };

/** What the editor's card dialog edits for a collection: the few fields a collection card shows. */
export type CollectionQuickEdit = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imagePath: string | null;
  productCount: number;
};

const toQuickEdit = (c: CollectionApi): CollectionQuickEdit => ({ id: c.id, slug: c.slug, name: c.name, description: c.description ?? "", imagePath: c.imagePath, productCount: c.productCount });

/** Reads a collection for the editor's "edit collection" dialog. */
export async function getCollectionForQuickEdit(id: string): Promise<CollectionQuickEdit> {
  const { tenant } = await requireActiveTenant();
  return toQuickEdit(await getCollectionApi(tenant.id, id));
}

/**
 * The whole collection as the update expects it, with the card's fields changed: the update replaces the collection, so its status,
 * address and products are sent back as they are. Not validated here: the caller runs it through the collection schema first.
 */
export async function buildCollectionQuickEditValues(patch: { id: string; name: string; description: string; imagePath: string | null }): Promise<Record<string, unknown>> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  const d = await getCollectionApi(tenant.id, patch.id);
  return { name: patch.name, slug: d.slug, description: patch.description, status: d.status, imagePath: patch.imagePath ?? d.imagePath, productIds: d.productIds };
}
