import type { Metadata } from "next";
import { publicImageUrl } from "@/lib/storage/paths";
import { THEME_ASSET_REGEX } from "@/lib/templates/engine/schema";

/**
 * Pure helpers for the storefront's search-engine and browser-tab metadata. No I/O, so they are unit tested directly.
 *
 * Home page: the store's own `metaTitle` / `metaDescription` win; otherwise the store name / description are used, exactly as
 * before. The custom title is ABSOLUTE so the root layout's `%s | <platform>` template does not append the platform name to it.
 * Only the home page calls this; every other storefront page keeps its own store-name-based title.
 */
export type HomeSeoSource = { name: string; description: string | null; meta_title?: string | null; meta_description?: string | null };

export function homeMetadata(store: HomeSeoSource): Metadata {
  const custom = store.meta_title?.trim();
  const title = custom ? { absolute: custom } : store.name;
  const description = store.meta_description?.trim() || store.description?.trim() || undefined;
  // The plain string form is the same text without the template, which is what Open Graph and Twitter need.
  const text = custom || store.name;
  return {
    title,
    description,
    openGraph: { title: text, description, type: "website", siteName: store.name },
    twitter: { card: "summary", title: text, description },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A plain file name: starts with a letter, digit, `_` or `-`, and uses only the characters the upload API generates (`<uuid>.<ext>`). */
const FILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/;
/** The image types the upload API accepts (JPEG, PNG, WebP). A favicon is never a video. */
const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

/**
 * True for exactly `<tenant uuid>/store/<file>.<jpg|jpeg|png|webp>`: the shape the upload API gives a store image. Anything else
 * (another folder, a nested path, `..`, a backslash, an empty name, another file type) is false.
 *
 * This checks the SHAPE only. It cannot tell whether the uuid is THIS store's tenant, because the public storefront response does
 * not carry the tenant id. That is enforced when the theme is saved (the Studio editor's `imagePathViolation` and the API's
 * `imageProblem` both require the path to start with the saving tenant's own `<tenantId>/store/`), and the layout endpoint
 * returns only the requested store's published theme.
 */
export function isTenantStoreImagePath(path: unknown): path is string {
  if (typeof path !== "string") return false;
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  const [tenant, folder, file] = parts;
  return UUID.test(tenant) && folder === "store" && FILE_NAME.test(file) && !file.includes("..") && IMAGE_EXTENSION.test(file);
}

/**
 * The favicon URL of the store's PUBLISHED theme (`settings.brand.favicon`, the Studio Brand setting), or null when none is set
 * or the value is not a usable image. `{ asset }` is a picture that ships with a theme (served from /themes); `{ path }` is a file
 * in the store's own image folder, turned into a public storage URL. Exactly one of the two must be present, as the API requires.
 * Free-form strings and other addresses are ignored, so a theme document can never point a browser tab at an arbitrary site.
 */
export function faviconUrlFromTheme(theme: Record<string, unknown> | null | undefined): string | null {
  const settings = theme && typeof theme === "object" ? (theme as { settings?: unknown }).settings : undefined;
  const brand = settings && typeof settings === "object" ? (settings as { brand?: unknown }).brand : undefined;
  const favicon = brand && typeof brand === "object" ? (brand as { favicon?: unknown }).favicon : undefined;
  if (!favicon || typeof favicon !== "object" || Array.isArray(favicon)) return null;
  const { path, asset } = favicon as { path?: unknown; asset?: unknown };
  if ((path === undefined) === (asset === undefined)) return null;
  if (path !== undefined) return isTenantStoreImagePath(path) ? publicImageUrl(path) : null;
  return typeof asset === "string" && THEME_ASSET_REGEX.test(asset) && !asset.includes("..") && IMAGE_EXTENSION.test(asset) ? `/themes/${asset}` : null;
}

/** Tab icon metadata for a storefront. With no favicon it adds nothing, so the platform icons from the root layout stay. */
export function faviconMetadata(url: string | null): Metadata {
  return url ? { icons: { icon: [{ url }], shortcut: [{ url }] } } : {};
}

/**
 * The platform's own icons. Declared as metadata on the ROOT layout (the files live in /public) instead of as app/favicon.ico and
 * app/icon.png: Next.js always keeps a root app/favicon.ico first in the icon list, so a store's icon could never replace it.
 * A nested layout's `icons` replaces this value completely (metadata merges shallowly).
 */
export const PLATFORM_ICONS: NonNullable<Metadata["icons"]> = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/icon.png", type: "image/png", sizes: "512x512" },
  ],
};
