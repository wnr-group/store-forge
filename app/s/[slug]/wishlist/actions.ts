"use server";

import { z } from "zod";
import { getPublicProductApi } from "@/lib/api/endpoints/public-api";
import { AppError } from "@/lib/errors";
import { MAX_WISHLIST, type ItemCheck } from "@/lib/wishlist/wishlist";

/**
 * Refreshes saved products from the store's LIVE public data: deleted products are reported as gone, the others come back
 * with their current name, picture, price and availability. Public data only, under the one store slug it is given, so one
 * store's wishlist can never see another store's products. It changes nothing.
 */
const inputSchema = z.object({
  storeSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  productSlugs: z.array(z.string().min(1).max(200)).max(MAX_WISHLIST),
});

export async function checkWishlistAction(input: unknown): Promise<ItemCheck[]> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return [];
  const { storeSlug } = parsed.data;
  const slugs = [...new Set(parsed.data.productSlugs)];
  const out: ItemCheck[] = [];
  await Promise.all(
    slugs.map(async (productSlug) => {
      try {
        const data = await getPublicProductApi(storeSlug, productSlug);
        out.push({
          status: "ok",
          productSlug,
          name: data.product.name,
          shortDescription: data.product.short_description,
          imagePath: data.images[0]?.path ?? null,
          priceMinor: data.product.price_minor,
          compareAtMinor: data.product.compare_at_price_minor,
          available: data.product.available !== false,
        });
      } catch (error) {
        // Only a definite "not found" removes an item; a network problem leaves the wishlist alone.
        if (error instanceof AppError && error.code === "NOT_FOUND") out.push({ status: "gone", productSlug });
      }
    }),
  );
  return out;
}
