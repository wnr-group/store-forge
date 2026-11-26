import { describe, expect, it } from "vitest";
import { z } from "zod";
import { storefrontSchema } from "@/services/storefront.service";

/** Frozen copy of the schema the previous app version used: a plain z.object (unknown keys ignored). */
const previousSchema = z.object({
  name: z.string(), slug: z.string(), description: z.string().nullable(), logo_path: z.string().nullable(), currency: z.string(),
  products: z.array(z.object({ name: z.string(), slug: z.string(), short_description: z.string().nullable(), price_minor: z.number(), compare_at_price_minor: z.number().nullable(), image_path: z.string().nullable() })),
});

const base = { name: "N", slug: "n-shop", description: null, logo_path: null, currency: "INR", products: [] };
const template = { key: "spotlight", accent_color: "#aaaaaa", hero_heading: "H", hero_subheading: null, hero_image_path: null };

describe("storefrontSchema", () => {
  it("accepts the old response shape (no template key)", () => {
    expect(storefrontSchema.parse(base).template).toBeUndefined();
  });
  it("parses the SEO title and description of the home page", () => {
    const r = storefrontSchema.parse({ ...base, meta_title: "Acme | Candles", meta_description: "Hand-poured candles." });
    expect(r.meta_title).toBe("Acme | Candles");
    expect(r.meta_description).toBe("Hand-poured candles.");
  });
  it("accepts null SEO values, and an API that does not send them yet", () => {
    expect(storefrontSchema.parse({ ...base, meta_title: null, meta_description: null })).toMatchObject({ meta_title: null, meta_description: null });
    expect(storefrontSchema.parse(base).meta_title).toBeUndefined();
    expect(storefrontSchema.parse(base).meta_description).toBeUndefined();
  });
  it("rejects SEO values that are not text", () => {
    expect(storefrontSchema.safeParse({ ...base, meta_title: 5 }).success).toBe(false);
  });
  it("accepts a template object and template: null (store has no settings)", () => {
    expect(storefrontSchema.parse({ ...base, template }).template?.key).toBe("spotlight");
    expect(storefrontSchema.parse({ ...base, template: null }).template).toBeNull();
  });
  it("rejects a malformed template object", () => {
    expect(storefrontSchema.safeParse({ ...base, template: { key: 5 } }).success).toBe(false);
  });
  it("the previous app version still parses the new response shape", () => {
    expect(previousSchema.safeParse({ ...base, template }).success).toBe(true);
    expect(previousSchema.safeParse({ ...base, template: null }).success).toBe(true);
  });
});
