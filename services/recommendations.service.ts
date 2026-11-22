import "server-only";
import {
  getRecommendationsApi,
  setRecommendationsApi,
} from "@/lib/api/endpoints/recommendations-api";
import { requireActiveTenant } from "@/lib/tenant/context";

export async function getRecommendations(productId: string) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return getRecommendationsApi(tenant.id, productId);
}

export async function setRecommendations(
  productId: string,
  data: {
    recommendations: Array<{
      recommendedProductId: string;
      relationKind?: "cross_sell" | "upsell" | "related";
      position?: number;
    }>;
  },
) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return setRecommendationsApi(tenant.id, productId, data);
}
