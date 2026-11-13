import "server-only";
import { createPageApi, deletePageApi, listPagesApi, updatePageApi, type StorePageInput } from "@/lib/api/endpoints/pages-api";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * Content pages of the active workspace's store. Reading is open to every member; changing needs `store:manage`
 * (checked here and again by the API and the database). The workspace comes from the verified membership.
 */

export async function listPages() {
  const { tenant } = await requireActiveTenant();
  return listPagesApi(tenant.id);
}

export async function createPage(input: StorePageInput) {
  const { tenant } = await requireActiveTenant("store:manage");
  return createPageApi(tenant.id, input);
}

export async function updatePage(id: string, input: Partial<StorePageInput>) {
  const { tenant } = await requireActiveTenant("store:manage");
  return updatePageApi(tenant.id, id, input);
}

export async function deletePage(id: string) {
  const { tenant } = await requireActiveTenant("store:manage");
  return deletePageApi(tenant.id, id);
}
