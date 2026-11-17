"use server";

import { z } from "zod";
import { getPublicProductApi } from "@/lib/api/endpoints/public-api";
import { AppError } from "@/lib/errors";
import { MAX_LINES, type AddInput, type LineCheck } from "@/lib/cart/cart";

/**
 * Re-checks guest cart lines against the store's LIVE public products, so a price change, a sold-out product or a deleted
 * variant is noticed before the shopper relies on the cart. It reads public data only (the same anonymous API call the
 * product page makes), always under the one store slug it is given, so one store's cart can never see another store's
 * products. It changes nothing and returns no data that was not already public.
 */
const inputSchema = z.object({
  storeSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  lines: z
    .array(
      z.object({
        productSlug: z.string().min(1).max(200),
        variantId: z.string().min(1).max(100).nullable(),
      }),
    )
    .max(MAX_LINES),
});

export async function checkCartAction(input: unknown): Promise<LineCheck[]> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return [];
  const { storeSlug, lines } = parsed.data;

  const slugs = [...new Set(lines.map((l) => l.productSlug))];
  const products = new Map<string, Awaited<ReturnType<typeof getPublicProductApi>> | "gone" | "error">();
  await Promise.all(
    slugs.map(async (slug) => {
      try {
        products.set(slug, await getPublicProductApi(storeSlug, slug));
      } catch (error) {
        // Only a definite "not found" removes a line; a network problem leaves the shopper's cart alone.
        products.set(slug, error instanceof AppError && error.code === "NOT_FOUND" ? "gone" : "error");
      }
    }),
  );

  const checks: LineCheck[] = [];
  for (const line of lines) {
    const key = `${line.productSlug}::${line.variantId ?? "-"}`;
    const data = products.get(line.productSlug);
    if (!data || data === "error") continue;
    if (data === "gone") {
      checks.push({ key, status: "gone" });
      continue;
    }
    if (data.product.available === false) {
      checks.push({ key, status: "unavailable" });
      continue;
    }
    const imagePathById = new Map(data.images.map((i) => [i.id, i.path]));
    if (line.variantId) {
      const variant = data.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        checks.push({ key, status: "gone" });
        continue;
      }
      checks.push({
        key,
        status: "ok",
        name: data.product.name,
        variantTitle: variant.title,
        imagePath: (variant.image_id ? imagePathById.get(variant.image_id) : null) ?? data.images[0]?.path ?? null,
        unitPriceMinor: variant.price_minor,
        compareAtMinor: variant.compare_at_price_minor,
      });
    } else if (data.variants.length > 0) {
      // The product now has variants: a line without one can no longer be priced.
      checks.push({ key, status: "gone" });
    } else {
      checks.push({
        key,
        status: "ok",
        name: data.product.name,
        variantTitle: null,
        imagePath: data.images[0]?.path ?? null,
        unitPriceMinor: data.product.price_minor,
        compareAtMinor: data.product.compare_at_price_minor,
      });
    }
  }
  return checks;
}

const quickAddSchema = z.object({
  storeSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  productSlug: z.string().min(1).max(200),
});

export type QuickAddResult =
  | { status: "ok"; item: AddInput }
  | { status: "options" }
  | { status: "unavailable" }
  | { status: "gone" }
  | { status: "error" };

/**
 * "Add to bag" from a product card. The card only knows what the store list showed, so this reads the live public product:
 * the price added is the current one, a sold-out or deleted product is refused, and a product with variants is sent to its
 * page (a variant has to be chosen there). Public data only, under the one store slug it is given.
 */
export async function quickAddAction(input: unknown): Promise<QuickAddResult> {
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };
  const { storeSlug, productSlug } = parsed.data;
  try {
    const data = await getPublicProductApi(storeSlug, productSlug);
    if (data.product.available === false) return { status: "unavailable" };
    if (data.variants.length > 0) return { status: "options" };
    return {
      status: "ok",
      item: {
        productSlug,
        variantId: null,
        name: data.product.name,
        variantTitle: null,
        imagePath: data.images[0]?.path ?? null,
        unitPriceMinor: data.product.price_minor,
        compareAtMinor: data.product.compare_at_price_minor,
      },
    };
  } catch (error) {
    return error instanceof AppError && error.code === "NOT_FOUND" ? { status: "gone" } : { status: "error" };
  }
}
