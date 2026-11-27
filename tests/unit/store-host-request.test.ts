import { beforeEach, describe, expect, it, vi } from "vitest";

let host: string | null = null;
vi.mock("next/headers", () => ({ headers: async () => new Headers(host ? { host } : {}) }));

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000"));

describe("isStoreHostRequest", () => {
  it.each([
    ["blue-door-cafe-ubwpi3.lvh.me:3000", true],
    ["lvh.me:3000", false], // the main site
    ["www.lvh.me:3000", false], // reserved label
    ["evil.com", false],
    [null, false],
  ])("%s -> %s", async (h, expected) => {
    host = h;
    const { isStoreHostRequest } = await import("@/lib/tenant/request");
    expect(await isStoreHostRequest()).toBe(expected);
  });
});

describe("isMainHostRequest", () => {
  it.each([
    ["lvh.me:3000", true],
    ["LVH.ME:3000", true],
    ["blue-door-cafe-ubwpi3.lvh.me:3000", false],
    ["localhost:3000", false], // a server action's internal render
    [null, false],
  ])("%s -> %s", async (h, expected) => {
    host = h;
    const { isMainHostRequest } = await import("@/lib/tenant/request");
    expect(await isMainHostRequest()).toBe(expected);
  });
});
