import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getStorefrontApi } from "@/lib/api/endpoints/public-api";
import { AppError } from "@/lib/errors";

const templateSchema = z.object({
  key: z.string(),
  accent_color: z.string().nullable(),
  hero_heading: z.string().nullable(),
  hero_subheading: z.string().nullable(),
  hero_image_path: z.string().nullable(),
});

/** `template` is optional and nullable so a store with no settings, or a database not yet migrated, still renders the default. */
export const storefrontSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logo_path: z.string().nullable(),
  currency: z.string(),
  products: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      short_description: z.string().nullable(),
      price_minor: z.number(),
      compare_at_price_minor: z.number().nullable(),
      image_path: z.string().nullable(),
    }),
  ),
  template: templateSchema.nullish(),
});

export type PublicStorefront = z.infer<typeof storefrontSchema>;

/**
 * Public data for <slug>.<root domain>, from `GET /public/storefronts/:slug` of the StoreForge API. No session is involved
 * and none is trusted: the slug comes from the Host header, and the API returns only public fields of an active store in
 * an active company. Unknown, inactive and suspended stores all answer 404, which is "no store". Memoized per request:
 * generateMetadata and the page both ask for the same store, which should cost one API call, not two.
 */
export const getPublicStorefront = cache(async (slug: string): Promise<PublicStorefront | null> => {
  try {
    const s = await getStorefrontApi(slug);
    return storefrontSchema.parse({
      name: s.name,
      slug: s.slug,
      description: s.description,
      logo_path: s.logoPath,
      currency: s.currency,
      products: s.products.map((p) => ({
        name: p.name,
        slug: p.slug,
        short_description: p.shortDescription,
        price_minor: p.priceMinor,
        compare_at_price_minor: p.compareAtPriceMinor,
        image_path: p.imagePath,
      })),
      template: s.template,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
});
