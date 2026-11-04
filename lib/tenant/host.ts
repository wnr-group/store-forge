import { RESERVED_SLUGS } from "@/config/app";

/**
 * Subdomain routing: <store-slug>.<root domain>. Pure so the proxy and the tests share it.
 * `rootDomain` is NEXT_PUBLIC_ROOT_DOMAIN, including the port locally ("lvh.me:3000") and without
 * it in production ("store-forge.com"). `lvh.me` and every subdomain of it resolve to 127.0.0.1.
 *
 * The result is only a *hint* for which public storefront to render. It grants nothing: the data
 * comes from get_public_storefront(), which exposes public fields of active stores only.
 */
const LABEL = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Request header the proxy sets on a store subdomain so server code knows which store the host names.
 * The proxy ALWAYS deletes any client-supplied copy first, so only the Host header can set it.
 */
export const STORE_HEADER = "x-sf-store";

export const isStoreLabel = (v: string | null | undefined): v is string => !!v && LABEL.test(v) && !v.includes("--");

/**
 * On a store subdomain only these paths are the app (sign-in and that store's dashboard); everything
 * else is the public storefront. /admin is deliberately NOT here: the Platform Admin area exists only on
 * the main domain.
 */
export function isSubdomainAppPath(pathname: string): boolean {
  return ["/login", "/dashboard", "/no-workspace"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function storeSlugFromHost(host: string | null | undefined, rootDomain: string | null | undefined): string | null {
  if (!host || !rootDomain) return null;
  const h = host.trim().toLowerCase();
  const root = rootDomain.trim().toLowerCase().replace(/^\.+/, "");
  if (!root || !h.endsWith(`.${root}`)) return null;
  const label = h.slice(0, -(root.length + 1));
  if (label.includes(".") || !LABEL.test(label) || label.includes("--")) return null; // exactly one valid label
  if ((RESERVED_SLUGS as readonly string[]).includes(label)) return null; // www., app., admin., api., ...
  return label;
}

/** Public URL of a store: http for local roots (lvh.me / localhost), https otherwise. Null when no root domain is configured. */
export function storefrontUrl(slug: string, rootDomain: string | null | undefined): string | null {
  const root = rootDomain?.trim().toLowerCase();
  if (!root) return null;
  const local = /^(localhost|[^.]+\.localhost|lvh\.me|127\.0\.0\.1)(:\d+)?$/.test(root);
  return `${local ? "http" : "https"}://${slug}.${root}`;
}

/** "urban.lvh.me:3000" - the host part only, for display. Falls back to the bare slug when no root domain is set. */
export function storefrontHost(slug: string, rootDomain: string | null | undefined): string {
  const root = rootDomain?.trim().toLowerCase();
  return root ? `${slug}.${root}` : slug;
}

