import { describe, expect, it, vi } from "vitest";
import { resolveStoreHost, type HostLookup, type StoreLookup } from "@/lib/tenant/resolve-host";

// What the API knows: store slug -> tenant public id. A stored address (stores.subdomain) is `${slug}-${publicId}`.
const directory: Record<string, string> = { "urban-nest": "zqkod2", "mart-com": "mk9x2t", "acme-store": "k9m2x1", acme: "store" };
const bySubdomain = vi.fn<HostLookup>(async (label) => {
  const slug = Object.keys(directory).find((s) => `${s}-${directory[s]}` === label);
  return slug ? { slug, publicId: directory[slug] } : null;
});
const bySlug = vi.fn<StoreLookup>(async (slug) => directory[slug] ?? null);
const lookups = { bySubdomain, bySlug };

describe("resolveStoreHost", () => {
  it("resolves a stored address as the API reports it, without splitting the label", async () => {
    expect(await resolveStoreHost("urban-nest-zqkod2", lookups)).toEqual({ slug: "urban-nest", publicId: "zqkod2" });
    expect(await resolveStoreHost("mart-com-mk9x2t", lookups)).toEqual({ slug: "mart-com", publicId: "mk9x2t" });
    expect(bySubdomain).toHaveBeenCalledWith("urban-nest-zqkod2"); // the whole label, never a rebuilt one
  });

  it("never resolves another tenant's store from a mismatched or invented public id", async () => {
    expect(await resolveStoreHost("urban-nest-mk9x2t", lookups)).toBeNull(); // mart-com's id on urban-nest
    expect(await resolveStoreHost("urban-nest-zzzzzz", lookups)).toBeNull();
    expect(await resolveStoreHost("ghost-zqkod2", lookups)).toBeNull();
  });

  it("falls back to the older format: the whole label is the store slug, and the stored public id is reported", async () => {
    expect(await resolveStoreHost("urban-nest", lookups)).toEqual({ slug: "urban-nest", publicId: "zqkod2" });
    expect(await resolveStoreHost("acme-store", lookups)).toEqual({ slug: "acme", publicId: "store" }); // a confirmed stored address wins over the ambiguous reading
    expect(await resolveStoreHost("acme-store-k9m2x1", lookups)).toEqual({ slug: "acme-store", publicId: "k9m2x1" });
  });

  it("lets an API failure surface instead of being read as 'no such store'", async () => {
    const down = async () => Promise.reject(new Error("down"));
    await expect(resolveStoreHost("urban-nest-zqkod2", { bySubdomain: down, bySlug })).rejects.toThrow("down");
    await expect(resolveStoreHost("unknown-label", { bySubdomain: async () => null, bySlug: down })).rejects.toThrow("down");
  });
});
