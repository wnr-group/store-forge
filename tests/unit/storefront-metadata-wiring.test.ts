import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How the storefront layout and home page hand the store's favicon and SEO text to Next.js metadata, and how the favicon service
 * reads the published theme. The services are mocked; the pure helpers behind them are covered in storefront-seo.test.ts.
 */

const TENANT = "11111111-1111-4111-8111-111111111111";
const SUPABASE = "https://abc.supabase.co";

const getPublicLayoutApi = vi.fn();
vi.mock("@/lib/api/endpoints/public-api", () => ({ getPublicLayoutApi: (...a: unknown[]) => getPublicLayoutApi(...a) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const layoutWith = (favicon: unknown) => ({ source: "assigned", template: null, groups: {}, theme: { schemaVersion: 1, settings: { brand: { favicon } } } });

describe("getStorefrontFavicon", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/services/storefront.service");
  });

  it("reads the store's published theme by its slug and returns the favicon URL", async () => {
    getPublicLayoutApi.mockResolvedValue(layoutWith({ path: `${TENANT}/store/favicon.png` }));
    const { getStorefrontFavicon } = await import("@/services/storefront.service");
    await expect(getStorefrontFavicon("acme")).resolves.toBe(`${SUPABASE}/storage/v1/object/public/products/${TENANT}/store/favicon.png`);
    expect(getPublicLayoutApi).toHaveBeenCalledWith("acme", "index");
  });

  it("is null for a store whose theme has no favicon, or no published theme", async () => {
    const { getStorefrontFavicon } = await import("@/services/storefront.service");
    getPublicLayoutApi.mockResolvedValueOnce(layoutWith(null));
    await expect(getStorefrontFavicon("no-icon")).resolves.toBeNull();
    getPublicLayoutApi.mockResolvedValueOnce({ source: null, template: null, groups: {}, theme: null });
    await expect(getStorefrontFavicon("no-theme")).resolves.toBeNull();
  });

  it("is null, not an error, when the API fails: a broken lookup must never take the page down", async () => {
    getPublicLayoutApi.mockRejectedValue(new Error("API unavailable"));
    const { getStorefrontFavicon } = await import("@/services/storefront.service");
    await expect(getStorefrontFavicon("down")).resolves.toBeNull();
  });

  it("is null for a favicon that is not a store image (wrong folder, traversal, wrong type)", async () => {
    const { getStorefrontFavicon } = await import("@/services/storefront.service");
    for (const [i, path] of [`${TENANT}/collections/a.png`, `${TENANT}/store/../a.png`, `${TENANT}/store/a.svg`].entries()) {
      getPublicLayoutApi.mockResolvedValueOnce(layoutWith({ path }));
      await expect(getStorefrontFavicon(`bad-${i}`)).resolves.toBeNull();
    }
  });

  it("gives each store its own icon: two slugs, two themes, two results", async () => {
    const other = "22222222-2222-4222-8222-222222222222";
    getPublicLayoutApi.mockImplementation(async (slug: string) => layoutWith(slug === "alpha" ? { path: `${TENANT}/store/a.png` } : { path: `${other}/store/b.png` }));
    const { getStorefrontFavicon } = await import("@/services/storefront.service");
    expect(await getStorefrontFavicon("alpha")).toContain(`/${TENANT}/store/a.png`);
    expect(await getStorefrontFavicon("beta")).toContain(`/${other}/store/b.png`);
  });
});

describe("storefront layout metadata (the tab icon)", () => {
  const getStorefrontFavicon = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/services/storefront.service", () => ({ getStorefrontFavicon: (...a: unknown[]) => getStorefrontFavicon(...a) }));
    vi.doMock("@/services/integrations.service", () => ({ getTrackingConfig: async () => null }));
    vi.doMock("@/components/storefront/tracking/consent-banner", () => ({ ConsentBanner: () => null }));
    vi.doMock("@/components/storefront/tracking/tracking-provider", () => ({ TrackingProvider: () => null }));
  });

  it("adds the store's favicon for its own slug", async () => {
    getStorefrontFavicon.mockResolvedValue(`${SUPABASE}/storage/v1/object/public/products/${TENANT}/store/favicon.png`);
    const { generateMetadata } = await import("@/app/s/[slug]/layout");
    const m = await generateMetadata({ params: Promise.resolve({ slug: "acme" }) });
    expect(getStorefrontFavicon).toHaveBeenCalledWith("acme");
    expect(m.icons).toMatchObject({ icon: [{ url: expect.stringContaining(`${TENANT}/store/favicon.png`) }] });
  });

  it("adds nothing for a store without a favicon, so the platform icons stay", async () => {
    getStorefrontFavicon.mockResolvedValue(null);
    const { generateMetadata } = await import("@/app/s/[slug]/layout");
    expect(await generateMetadata({ params: Promise.resolve({ slug: "acme" }) })).toEqual({});
  });

  it("does not even look up a slug that is not lower case", async () => {
    getStorefrontFavicon.mockClear();
    const { generateMetadata } = await import("@/app/s/[slug]/layout");
    expect(await generateMetadata({ params: Promise.resolve({ slug: "Acme" }) })).toEqual({});
    expect(getStorefrontFavicon).not.toHaveBeenCalled();
  });
});

describe("storefront home page metadata", () => {
  const getPublicStorefront = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/services/storefront.service", () => ({ getPublicStorefront: (...a: unknown[]) => getPublicStorefront(...a), getPublishedDesign: async () => null }));
    vi.doMock("@/components/storefront/published-view", () => ({ PublishedView: () => null }));
    vi.doMock("@/components/storefront/templates", () => ({ TemplateView: () => null }));
  });

  const store = { name: "Acme Candles", slug: "acme", description: "Hand-poured soy candles.", logo_path: null, currency: "INR", products: [] };
  const metadata = async (slug: string) => {
    const { generateMetadata } = await import("@/app/s/[slug]/page");
    return generateMetadata({ params: Promise.resolve({ slug }) });
  };

  it("uses the custom SEO title and description, with Open Graph and Twitter", async () => {
    getPublicStorefront.mockResolvedValue({ ...store, meta_title: "Acme | Handmade candles", meta_description: "Poured by hand." });
    const m = await metadata("acme");
    expect(getPublicStorefront).toHaveBeenCalledWith("acme");
    expect(m.title).toEqual({ absolute: "Acme | Handmade candles" });
    expect(m.description).toBe("Poured by hand.");
    expect(m.openGraph).toMatchObject({ title: "Acme | Handmade candles", description: "Poured by hand." });
    expect(m.twitter).toMatchObject({ title: "Acme | Handmade candles", description: "Poured by hand." });
  });

  it("falls back to the store name and description", async () => {
    getPublicStorefront.mockResolvedValue({ ...store, meta_title: null, meta_description: null });
    const m = await metadata("acme");
    expect(m.title).toBe("Acme Candles");
    expect(m.description).toBe("Hand-poured soy candles.");
  });

  it("works with an API that does not send the SEO fields yet", async () => {
    getPublicStorefront.mockResolvedValue(store);
    const m = await metadata("acme");
    expect(m.title).toBe("Acme Candles");
    expect(m.description).toBe("Hand-poured soy candles.");
  });

  it("says 'Store not found' for an unknown store or a slug that is not lower case", async () => {
    getPublicStorefront.mockResolvedValue(null);
    expect(await metadata("ghost")).toEqual({ title: "Store not found" });
    expect(await metadata("Acme")).toEqual({ title: "Store not found" });
  });
});
