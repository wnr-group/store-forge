import "server-only";
import { apiRequest } from "@/lib/api/client";

export type ProductReviewApi = {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  status: "published" | "unpublished";
  source: "merchant_entered" | "imported";
  originLabel: string | null;
  verifiedPurchase: boolean;
  reviewedAt: string;
  createdAt: string;
};

export type ReviewListResponseApi = {
  items: ProductReviewApi[];
  total: number;
  limit: number;
  offset: number;
};

export const listReviewsApi = async (
  organizationId: string,
  query?: { productId?: string; status?: string; source?: string; limit?: number; offset?: number; sort?: string },
) =>
  (await apiRequest<ReviewListResponseApi>("/reviews", {
    organizationId,
    query,
  })).data;

export const createReviewApi = async (
  organizationId: string,
  json: {
    productId: string;
    authorName: string;
    rating: number;
    title: string;
    body: string;
    originLabel?: string;
    status?: "published" | "unpublished";
  },
) =>
  (await apiRequest<ProductReviewApi>("/reviews", {
    method: "POST",
    organizationId,
    json,
  })).data;

export const updateReviewApi = async (
  organizationId: string,
  id: string,
  json: {
    authorName?: string;
    rating?: number;
    title?: string;
    body?: string;
    originLabel?: string;
    status?: "published" | "unpublished";
  },
) =>
  (await apiRequest<ProductReviewApi>(`/reviews/${id}`, {
    method: "PATCH",
    organizationId,
    json,
  })).data;

export const publishReviewApi = async (organizationId: string, id: string) =>
  (await apiRequest<ProductReviewApi>(`/reviews/${id}/publish`, {
    method: "POST",
    organizationId,
  })).data;

export const unpublishReviewApi = async (organizationId: string, id: string) =>
  (await apiRequest<ProductReviewApi>(`/reviews/${id}/unpublish`, {
    method: "POST",
    organizationId,
  })).data;

export const deleteReviewApi = async (organizationId: string, id: string) =>
  (await apiRequest<{ success: boolean }>(`/reviews/${id}`, {
    method: "DELETE",
    organizationId,
  })).data;

export const importReviewsApi = async (
  organizationId: string,
  json: { csvContent: string; attestationId?: string; validateOnly?: boolean },
) =>
  (await apiRequest<{
    success: boolean;
    totalRows: number;
    validRows: number;
    importedRows: number;
    errors: Array<{ row: number; field: string; message: string }>;
  }>("/reviews/import", {
    method: "POST",
    organizationId,
    json,
  })).data;
