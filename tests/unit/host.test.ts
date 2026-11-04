import { describe, expect, it } from "vitest";
import { storeSlugFromHost, storefrontUrl } from "@/lib/tenant/host";

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
