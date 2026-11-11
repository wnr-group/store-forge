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
