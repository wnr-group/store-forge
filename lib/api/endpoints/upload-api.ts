import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `POST /uploads/signed-urls` of the StoreForge API. The API derives the storage folder from the verified organization. */
export type UploadTarget = { path: string; token: string; signedUrl: string };

export type UploadRequestApi = {
  scope: "product" | "collection" | "store" | "catalog";
  /** Product, collection or catalog item id; required unless `scope` is `store`. */
  ownerId?: string;
  files: { type: string; size: number }[];
};

export const requestSignedUploadsApi = async (organizationId: string, input: UploadRequestApi) =>
  (await apiRequest<UploadTarget[]>("/uploads/signed-urls", { method: "POST", json: input, organizationId })).data;
