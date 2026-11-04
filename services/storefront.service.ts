import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { rowsOf, withPublicContext } from "@/lib/db/user-context";

const storefrontSchema = z.object({
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
});

export type PublicStorefront = z.infer<typeof storefrontSchema>;

/**
 * Public data for <slug>.<root domain>. No session is involved and none is trusted: the slug comes
 * from the Host header, and the database function returns only public fields of an active store in an
 * active company, or null (unknown, inactive and suspended stores look identical).
 */
export async function getPublicStorefront(slug: string): Promise<PublicStorefront | null> {
  const row = await withPublicContext(getDatabase(), async (tx) =>
    rowsOf<{ s: unknown }>(await tx.execute(sql`select public.get_public_storefront(${slug}) as s`))[0]?.s,
  );
  if (row === null || row === undefined) return null;
  return storefrontSchema.parse(typeof row === "string" ? JSON.parse(row) : row);
}
