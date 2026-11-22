import "server-only";
import {
  createReviewApi,
  deleteReviewApi,
  importReviewsApi,
  listReviewsApi,
  publishReviewApi,
  unpublishReviewApi,
  updateReviewApi,
} from "@/lib/api/endpoints/reviews-api";
import { requireActiveTenant } from "@/lib/tenant/context";

export async function listReviews(query?: {
  productId?: string;
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return listReviewsApi(tenant.id, query);
}

export async function createReview(data: {
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  originLabel?: string;
  status?: "published" | "unpublished";
}) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return createReviewApi(tenant.id, data);
}

export async function updateReview(
  id: string,
  data: {
    authorName?: string;
    rating?: number;
    title?: string;
    body?: string;
    originLabel?: string;
    status?: "published" | "unpublished";
  },
) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return updateReviewApi(tenant.id, id, data);
}

export async function publishReview(id: string) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return publishReviewApi(tenant.id, id);
}

export async function unpublishReview(id: string) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return unpublishReviewApi(tenant.id, id);
}

export async function deleteReview(id: string) {
  const { tenant } = await requireActiveTenant("catalog:delete");
  return deleteReviewApi(tenant.id, id);
}

export async function importReviews(data: {
  csvContent: string;
  attestationId?: string;
  validateOnly?: boolean;
}) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return importReviewsApi(tenant.id, data);
}
