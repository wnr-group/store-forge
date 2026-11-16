import { describe, expect, it, vi } from "vitest";
import { resolveStoreHost, type StoreLookup } from "@/lib/tenant/resolve-host";

const directory: Record<string, string> = { "urban-nest": "zqkod2", "mart-com": "mk9x2t", "acme-store": "k9m2x1", acme: "store" };
const lookup = vi.fn<StoreLookup>(async (slug) => directory[slug] ?? null);

describe("resolveStoreHost", () => {
  it("resolves {slug}-{publicId} only when the public id belongs to that store", async () => {
    expect(await resolveStoreHost("urban-nest-zqkod2", lookup)).toEqual({ slug: "urban-nest", publicId: "zqkod2" });
    expect(await resolveStoreHost("mart-com-mk9x2t", lookup)).toEqual({ slug: "mart-com", publicId: "mk9x2t" });
  });

  it("never resolves another tenant's store from a mismatched or invented public id", async () => {
    expect(await resolveStoreHost("urban-nest-mk9x2t", lookup)).toBeNull(); // mart-com's id on urban-nest
    expect(await resolveStoreHost("urban-nest-zzzzzz", lookup)).toBeNull();
    expect(await resolveStoreHost("ghost-zqkod2", lookup)).toBeNull();
  });

  it("falls back to the older format: the whole label is the store slug, and the stored public id is reported", async () => {
    expect(await resolveStoreHost("urban-nest", lookup)).toEqual({ slug: "urban-nest", publicId: "zqkod2" });
    expect(await resolveStoreHost("acme-store", lookup)).toEqual({ slug: "acme", publicId: "store" }); // confirmed slug + id wins over the ambiguous reading
    expect(await resolveStoreHost("acme-store-k9m2x1", lookup)).toEqual({ slug: "acme-store", publicId: "k9m2x1" }); // split at the LAST hyphen
  });

  it("lets an API failure surface instead of being read as 'no such store'", async () => {
    await expect(resolveStoreHost("urban-nest-zqkod2", async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
  });
});
