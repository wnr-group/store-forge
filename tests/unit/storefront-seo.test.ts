import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { faviconMetadata, faviconUrlFromTheme, homeMetadata, isTenantStoreImagePath, PLATFORM_ICONS } from "@/lib/storefront/seo";

/** Home page SEO text and the store's tab icon: pure helpers, no I/O. */

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const SUPABASE = "https://abc.supabase.co";
const STORAGE = `${SUPABASE}/storage/v1/object/public/products`;

const store = { name: "Acme Candles", description: "Hand-poured soy candles." };

describe("homeMetadata", () => {
  it("uses the store's own SEO title and description when they are set", () => {
    const m = homeMetadata({ ...store, meta_title: "Acme | Handmade candles", meta_description: "Small-batch candles, poured by hand." });
    expect(m.title).toEqual({ absolute: "Acme | Handmade candles" });
    expect(m.description).toBe("Small-batch candles, poured by hand.");
  });

  it("falls back to the store name and description (as before the SEO fields existed)", () => {
    for (const none of [{}, { meta_title: null, meta_description: null }, { meta_title: undefined, meta_description: undefined }]) {
      const m = homeMetadata({ ...store, ...none });
      expect(m.title).toBe("Acme Candles");
      expect(m.description).toBe("Hand-poured soy candles.");
    }
  });

  it("falls back per field: a custom title keeps the store description, and the other way round", () => {
    const titleOnly = homeMetadata({ ...store, meta_title: "Custom" });
    expect(titleOnly.title).toEqual({ absolute: "Custom" });
    expect(titleOnly.description).toBe("Hand-poured soy candles.");
    const descriptionOnly = homeMetadata({ ...store, meta_description: "Custom text" });
    expect(descriptionOnly.title).toBe("Acme Candles");
    expect(descriptionOnly.description).toBe("Custom text");
  });

  it("treats whitespace-only values as not set", () => {
    const m = homeMetadata({ ...store, meta_title: "   ", meta_description: "\n\t " });
    expect(m.title).toBe("Acme Candles");
    expect(m.description).toBe("Hand-poured soy candles.");
  });

  it("has no description at all when neither the SEO text nor the store has one", () => {
    expect(homeMetadata({ name: "Bare", description: null }).description).toBeUndefined();
    expect(homeMetadata({ name: "Bare", description: "  " }).description).toBeUndefined();
  });

  it("trims the custom values", () => {
    const m = homeMetadata({ ...store, meta_title: "  Spaced  ", meta_description: "  Text  " });
    expect(m.title).toEqual({ absolute: "Spaced" });
    expect(m.description).toBe("Text");
  });

  it("makes the custom title absolute, so the platform's `%s | name` template is not appended; the fallback stays a plain string", () => {
    expect(homeMetadata({ ...store, meta_title: "Custom" }).title).toEqual({ absolute: "Custom" });
    expect(typeof homeMetadata(store).title).toBe("string");
  });

  it("carries the same text into Open Graph and Twitter (the plain title, without the template)", () => {
    const m = homeMetadata({ ...store, meta_title: "Acme | Handmade candles", meta_description: "Poured by hand." });
    expect(m.openGraph).toMatchObject({ title: "Acme | Handmade candles", description: "Poured by hand.", type: "website", siteName: "Acme Candles" });
    expect(m.twitter).toMatchObject({ card: "summary", title: "Acme | Handmade candles", description: "Poured by hand." });
  });

  it("uses the store name and description in Open Graph and Twitter when no SEO text is set", () => {
    const m = homeMetadata(store);
    expect(m.openGraph).toMatchObject({ title: "Acme Candles", description: "Hand-poured soy candles.", siteName: "Acme Candles" });
    expect(m.twitter).toMatchObject({ title: "Acme Candles", description: "Hand-poured soy candles." });
  });

  it("does not set tab icons (the storefront layout owns those)", () => {
    expect(homeMetadata({ ...store, meta_title: "x" }).icons).toBeUndefined();
  });
});

describe("isTenantStoreImagePath", () => {
  it.each([
    [`${TENANT}/store/favicon.png`],
    [`3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40/store/favicon.png`],
    [`${TENANT}/store/photo.jpg`],
    [`${TENANT}/store/photo.jpeg`],
    [`${TENANT}/store/icon.webp`],
    [`${TENANT}/store/3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40.png`],
    [`${TENANT}/store/FAVICON.PNG`],
    [`${TENANT}/store/my-icon_v2.1.png`],
  ])("accepts %s", (path) => {
    expect(isTenantStoreImagePath(path)).toBe(true);
  });

  it.each([
    ["", "an empty path"],
    ["/", "a bare slash"],
    ["favicon.png", "a bare file name"],
    [`${TENANT}/store/`, "no file name"],
    [`${TENANT}/store`, "no file"],
    [`${TENANT}/store/.png`, "an extension with no name"],
    [`${TENANT}/store/.hidden.png`, "a hidden file"],
    [`${TENANT}/store/sub/favicon.png`, "a nested folder"],
    [`${TENANT}/store/a/b/favicon.png`, "deeply nested"],
    [`${TENANT}/${OTHER_TENANT}/store/favicon.png`, "an extra folder before store"],
    [`${TENANT}/collections/favicon.png`, "the collections folder"],
    [`${TENANT}/22222222-2222-4222-8222-222222222222/favicon.png`, "a product folder"],
    [`${TENANT}/products/favicon.png`, "a different folder name"],
    [`${TENANT}/Store/favicon.png`, "a different folder case"],
    [`store/favicon.png`, "no tenant"],
    [`not-a-uuid/store/favicon.png`, "a tenant that is not a uuid"],
    [`3F2B1C9E-8A4D-4C1E-9F6A-2B7D5E8C1A40/store/favicon.png`, "an upper-case uuid (the database always uses lower case)"],
    [`${TENANT.slice(0, -1)}/store/favicon.png`, "a short uuid"],
    [`${TENANT}x/store/favicon.png`, "a long uuid"],
    [`../store/favicon.png`, "a traversal at the start"],
    [`${TENANT}/../store/favicon.png`, "traversal in place of the folder"],
    [`${TENANT}/store/../favicon.png`, "traversal in the file part"],
    [`${TENANT}/store/..%2Ffavicon.png`, "an encoded traversal"],
    [`${TENANT}/store/a..png`, "a double dot in the name"],
    [`${TENANT}/store/..`, "just .."],
    [`${TENANT}\\store\\favicon.png`, "backslashes"],
    [`${TENANT}/store/fav\\icon.png`, "a backslash in the name"],
    [`${TENANT}/store/fav icon.png`, "a space in the name"],
    [`${TENANT}/store/favicon.png?x=1`, "a query string"],
    [`${TENANT}/store/favicon.png\n`, "a trailing newline"],
    [`${TENANT}/store/favicon.png\u0000`, "a null byte"],
    [`https://evil.example/${TENANT}/store/favicon.png`, "a full URL"],
    [`//evil.example/store/favicon.png`, "a protocol-relative URL"],
    [`${TENANT}/store/${"a".repeat(121)}.png`, "a name over 120 characters"],
  ])("rejects %s (%s)", (path) => {
    expect(isTenantStoreImagePath(path)).toBe(false);
  });

  it.each([["favicon.gif"], ["favicon.svg"], ["favicon.ico"], ["favicon.bmp"], ["favicon.mp4"], ["favicon.webm"], ["favicon.png.exe"], ["favicon.pdf"], ["favicon"], ["favicon."], ["favicon.png.txt"]])(
    "rejects the unsupported file %s (only JPEG, PNG and WebP are image types of the upload API)",
    (file) => {
      expect(isTenantStoreImagePath(`${TENANT}/store/${file}`)).toBe(false);
    },
  );

  it("rejects values that are not text", () => {
    for (const v of [null, undefined, 5, {}, [], [`${TENANT}/store/favicon.png`], true]) expect(isTenantStoreImagePath(v)).toBe(false);
  });
});

describe("faviconUrlFromTheme", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const themeWith = (favicon: unknown) => ({ schemaVersion: 1, settings: { brand: { look: "classic", favicon } } });

  it("turns a tenant favicon path into the public storage URL", () => {
    expect(faviconUrlFromTheme(themeWith({ path: `${TENANT}/store/favicon.png`, alt: "icon" }))).toBe(`${STORAGE}/${TENANT}/store/favicon.png`);
  });

  it("works without an alt text, and for JPEG and WebP", () => {
    expect(faviconUrlFromTheme(themeWith({ path: `${TENANT}/store/a.webp` }))).toBe(`${STORAGE}/${TENANT}/store/a.webp`);
    expect(faviconUrlFromTheme(themeWith({ path: `${TENANT}/store/a.jpg` }))).toBe(`${STORAGE}/${TENANT}/store/a.jpg`);
  });

  it("serves a theme-supplied picture from /themes", () => {
    expect(faviconUrlFromTheme(themeWith({ asset: "maison/icon.png" }))).toBe("/themes/maison/icon.png");
  });

  it("returns null when there is no favicon, no brand group, no settings or no theme", () => {
    expect(faviconUrlFromTheme(themeWith(null))).toBeNull();
    expect(faviconUrlFromTheme(themeWith(undefined))).toBeNull();
    expect(faviconUrlFromTheme({ schemaVersion: 1, settings: { brand: {} } })).toBeNull();
    expect(faviconUrlFromTheme({ schemaVersion: 1, settings: {} })).toBeNull();
    expect(faviconUrlFromTheme({ schemaVersion: 1 })).toBeNull();
    expect(faviconUrlFromTheme({})).toBeNull();
    expect(faviconUrlFromTheme(null)).toBeNull();
    expect(faviconUrlFromTheme(undefined)).toBeNull();
  });

  it("returns null for malformed values instead of throwing", () => {
    for (const bad of ["https://evil.example/x.png", "favicon.png", 5, true, [], [{ path: `${TENANT}/store/a.png` }], {}, { path: 5 }, { path: null }, { alt: "only alt" }]) {
      expect(faviconUrlFromTheme(themeWith(bad))).toBeNull();
    }
    expect(faviconUrlFromTheme({ settings: "nope" })).toBeNull();
    expect(faviconUrlFromTheme({ settings: { brand: "nope" } })).toBeNull();
    expect(faviconUrlFromTheme({ settings: [] })).toBeNull();
  });

  it("returns null for a path outside the store folder, a traversal, or an unsupported type", () => {
    for (const path of [`${TENANT}/collections/a.png`, `${TENANT}/store/../a.png`, `${TENANT}/store/a.gif`, `${TENANT}/store/a.svg`, `${TENANT}/store/sub/a.png`, "", `x/store/a.png`, "https://evil.example/a.png"]) {
      expect(faviconUrlFromTheme(themeWith({ path }))).toBeNull();
    }
  });

  it("returns null when both a path and an asset are given (the API requires exactly one)", () => {
    expect(faviconUrlFromTheme(themeWith({ path: `${TENANT}/store/a.png`, asset: "maison/icon.png" }))).toBeNull();
  });

  it("returns null for a bad theme asset: traversal, wrong shape or an unsupported type", () => {
    for (const asset of ["../secret.png", "maison/../a.png", "maison/icon.svg", "maison/icon.ico", "Maison/icon.png", "icon.png", "maison/sub/icon.png", "/maison/icon.png", "", 5]) {
      expect(faviconUrlFromTheme(themeWith({ asset }))).toBeNull();
    }
  });

  it("returns null when the storage address is not configured, rather than a broken URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(faviconUrlFromTheme(themeWith({ path: `${TENANT}/store/a.png` }))).toBeNull();
  });

  it("only echoes the path it was given: two themes give two different URLs, with no shared state", () => {
    const a = faviconUrlFromTheme(themeWith({ path: `${TENANT}/store/a.png` }));
    const b = faviconUrlFromTheme(themeWith({ path: `${OTHER_TENANT}/store/b.png` }));
    const none = faviconUrlFromTheme(themeWith(null));
    expect(a).toBe(`${STORAGE}/${TENANT}/store/a.png`);
    expect(b).toBe(`${STORAGE}/${OTHER_TENANT}/store/b.png`);
    expect(none).toBeNull();
  });
});

describe("faviconMetadata", () => {
  it("adds nothing when the store has no favicon, so the platform icons of the root layout stay", () => {
    expect(faviconMetadata(null)).toEqual({});
  });

  it("returns the store's icon when it has one", () => {
    const url = `${STORAGE}/${TENANT}/store/favicon.png`;
    expect(faviconMetadata(url)).toEqual({ icons: { icon: [{ url }], shortcut: [{ url }] } });
  });
});

describe("PLATFORM_ICONS (the fallback declared by the root layout)", () => {
  it("points at the static files in /public", () => {
    expect(PLATFORM_ICONS).toEqual({
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
    });
  });
});
