import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** next/image refuses remote hosts that next.config.ts does not allow, so the hero URL must match a configured pattern. */
describe("hero image rendering configuration", () => {
  it("the public URL of a hero path matches the configured next/image remotePatterns", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    const { matchRemotePattern } = await import("next/dist/shared/lib/match-remote-pattern");
    const { publicImageUrl } = await import("@/lib/storage/paths");

    const patterns = config.images?.remotePatterns ?? [];
    expect(patterns.length).toBeGreaterThan(0);

    const hero = new URL(publicImageUrl("11111111-1111-1111-1111-111111111111/store/hero.webp")!);
    expect(patterns.some((p) => matchRemotePattern(p, hero)), hero.href).toBe(true);

    // Only the public products bucket on the project's own host is allowed.
    expect(patterns.some((p) => matchRemotePattern(p, new URL("https://abc.supabase.co/storage/v1/object/public/other/x.webp")))).toBe(false);
    expect(patterns.some((p) => matchRemotePattern(p, new URL("https://evil.example.com/storage/v1/object/public/products/x.webp")))).toBe(false);
  });
});
