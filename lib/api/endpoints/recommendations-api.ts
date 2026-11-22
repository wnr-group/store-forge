import "server-only";
import { apiRequest } from "@/lib/api/client";

export type RecommendedProductItemApi = {
  id: string;
  recommendedProductId: string;
  relationKind: "cross_sell" | "upsell" | "related";
  position: number;
  product: {
    name: string;
    slug: string;
    priceMinor: number;
    compareAtPriceMinor: number | null;
    imagePath: string | null;
    available: boolean;
  };
};

export const getRecommendationsApi = async (organizationId: string, productId: string) =>
  (await apiRequest<RecommendedProductItemApi[]>(
    `/store/products/${productId}/recommendations`,
    { organizationId },
  )).data;

export const setRecommendationsApi = async (
  organizationId: string,
  productId: string,
  json: {
    recommendations: Array<{
      recommendedProductId: string;
      relationKind?: "cross_sell" | "upsell" | "related";
      position?: number;
    }>;
  },
) =>
  (await apiRequest<RecommendedProductItemApi[]>(
    `/store/products/${productId}/recommendations`,
    { method: "PUT", organizationId, json },
  )).data;
