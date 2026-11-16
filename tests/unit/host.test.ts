import { describe, expect, it } from "vitest";
import { splitStoreLabel, storeSlugFromHost, storefrontHost, storefrontUrl } from "@/lib/tenant/host";

describe("storeSlugFromHost", () => {
  it.each([
    ["urban.lvh.me:3000", "lvh.me:3000", "urban"],
    ["URBAN.LVH.ME:3000", "lvh.me:3000", "urban"],
    ["urban-nest.store-forge.com", "store-forge.com", "urban-nest"],
    ["urban.localhost:3000", "localhost:3000", "urban"],
  ])("%s under %s -> %s", (host, root, slug) => {
    expect(storeSlugFromHost(host, root)).toBe(slug);
  });

  it.each([
    ["lvh.me:3000", "lvh.me:3000"], // the root itself is the main app
    ["localhost:3000", "lvh.me:3000"],
    ["www.store-forge.com", "store-forge.com"], // reserved
    ["admin.store-forge.com", "store-forge.com"],
    ["app.lvh.me:3000", "lvh.me:3000"],
    ["a.b.store-forge.com", "store-forge.com"], // only one label
    ["urban.lvh.me:4000", "lvh.me:3000"], // wrong port
    ["evilstore-forge.com", "store-forge.com"], // suffix without the dot
    ["urban.store-forge.com.evil.com", "store-forge.com"],
    ["-bad-.store-forge.com", "store-forge.com"],
    ["ur--ban.store-forge.com", "store-forge.com"],
    ["x.store-forge.com", "store-forge.com"], // too short
    ["urban.store-forge.com", ""], // routing disabled
    ["urban.store-forge.com", undefined],
    [null, "store-forge.com"],
  ])("ignores %s under %s", (host, root) => {
    expect(storeSlugFromHost(host as string | null, root as string | undefined)).toBeNull();
  });
});

describe("storefrontUrl", () => {
  it("uses http for local roots and https otherwise", () => {
    expect(storefrontUrl("urban", "lvh.me:3000")).toBe("http://urban.lvh.me:3000");
    expect(storefrontUrl("urban", "localhost:3000")).toBe("http://urban.localhost:3000");
    expect(storefrontUrl("urban", "store-forge.com")).toBe("https://urban.store-forge.com");
    expect(storefrontUrl("urban", "")).toBeNull();
    expect(storefrontUrl("urban", undefined)).toBeNull();
  });
});

describe("storefront addresses with a public id", () => {
  it("builds {slug}-{publicId} hosts and URLs", () => {
    expect(storefrontUrl("urban-nest", "lvh.me:3000", "zqkod2")).toBe("http://urban-nest-zqkod2.lvh.me:3000");
    expect(storefrontUrl("urban-nest", "store-forge.com", "zqkod2")).toBe("https://urban-nest-zqkod2.store-forge.com");
    expect(storefrontHost("urban-nest", "lvh.me:3000", "zqkod2")).toBe("urban-nest-zqkod2.lvh.me:3000");
  });

  it("falls back to the bare slug (older address) without a usable public id", () => {
    expect(storefrontUrl("urban", "lvh.me:3000")).toBe("http://urban.lvh.me:3000");
    expect(storefrontUrl("urban", "lvh.me:3000", null)).toBe("http://urban.lvh.me:3000");
    expect(storefrontUrl("urban", "lvh.me:3000", "ZQ!")).toBe("http://urban.lvh.me:3000");
    expect(storefrontHost("urban", undefined, "zqkod2")).toBe("urban-zqkod2");
  });

  it("round-trips: what is built is what the proxy parses", () => {
    const host = storefrontHost("urban-nest", "lvh.me:3000", "zqkod2");
    const label = storeSlugFromHost(host, "lvh.me:3000");
    expect(label).toBe("urban-nest-zqkod2");
    expect(splitStoreLabel(label!)).toEqual({ slug: "urban-nest", publicId: "zqkod2" });
  });

  it("accepts the longest store slug plus a public id as one host label", () => {
    const slug = "a".repeat(40);
    expect(storeSlugFromHost(`${slug}-zqkod2.lvh.me:3000`, "lvh.me:3000")).toBe(`${slug}-zqkod2`);
  });
});

describe("splitStoreLabel", () => {
  it.each([
    ["urban-nest-zqkod2", { slug: "urban-nest", publicId: "zqkod2" }],
    ["urban-abcde", { slug: "urban", publicId: "abcde" }],
    ["shop-12345678", { slug: "shop", publicId: "12345678" }],
  ])("%s", (label, expected) => expect(splitStoreLabel(label)).toEqual(expected));

  it.each(["urban", "urban-nest", "urban-abcd", "urban-abcdefghi", "-zqkod2", "a-zqkod2", "urban-ZQKOD2"])("%s is not slug + public id", (label) => {
    expect(splitStoreLabel(label)).toBeNull();
  });
});
