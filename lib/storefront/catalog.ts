import { PUBLIC_CATALOG_SORTS, type PublicCatalogBreadcrumb, type PublicCatalogLevel, type PublicCatalogNode, type PublicCatalogNodePage, type PublicCatalogProduct, type PublicCatalogProductPage, type PublicCatalogSort, type PublicCatalogTree } from "@/lib/catalog/public-types";

/**
 * Everything the storefront needs to show the catalog hierarchy, independent of the template: the URL scheme, how the address and query
 * are read, and the one plain object (`CatalogRenderData`) every template's catalog section draws. Pure functions, no fetching.
 */

export const CATALOG_PATH = "/catalog";
export const CATALOG_PAGE_SIZE = 24;
/** Item slugs are at most 80 characters and a catalog is at most 20 levels deep: anything longer is not an address of ours. */
const MAX_SEGMENTS = 20;
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CatalogQuery = { page: number; sort: PublicCatalogSort; all: boolean };

export type CatalogRenderData = {
  /** `root` = the top of the catalog, `node` = one item, `unavailable` = the store has no published catalog. */
  view: "root" | "node" | "unavailable";
  hierarchyName: string | null;
  levels: PublicCatalogLevel[];
  node: (PublicCatalogNode & { level: PublicCatalogLevel }) | null;
  breadcrumbs: PublicCatalogBreadcrumb[];
  /** The items one step down (the top level at the root). */
  children: PublicCatalogNode[];
  /** What the children are called (the name of their level), e.g. "Variant"; null when there are none. */
  childLevelName: string | null;
  products: PublicCatalogProductPage | null;
  query: CatalogQuery;
};

/** The segments of a catalog address, or null when any of them cannot be an item slug (the page is then simply not found). */
export function catalogSegments(path: string[] | undefined): string[] | null {
  const segments = (path ?? []).map((s) => s.toLowerCase());
  if (segments.length > MAX_SEGMENTS || segments.some((s) => s.length === 0 || s.length > 80 || !SEGMENT.test(s))) return null;
  return segments;
}

export const catalogHref = (path?: string | null): string => (path ? `${CATALOG_PATH}/${path}` : CATALOG_PATH);

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The page, sort and "include sub-items" choice from `?page=&sort=&all=`. Anything unusable falls back to the default. */
export function parseCatalogQuery(raw: Record<string, string | string[] | undefined>): CatalogQuery {
  const page = Number(first(raw.page));
  const sort = first(raw.sort);
  return {
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
    sort: (PUBLIC_CATALOG_SORTS as readonly string[]).includes(sort ?? "") ? (sort as PublicCatalogSort) : "position",
    all: first(raw.all) === "1",
  };
}

/** `base` with the choices that differ from the defaults in its query string (so a plain page keeps a plain address). */
export function catalogQueryHref(base: string, query: Partial<CatalogQuery>): string {
  const params = new URLSearchParams();
  if (query.sort && query.sort !== "position") params.set("sort", query.sort);
  if (query.all) params.set("all", "1");
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}

export const SORT_LABELS: Record<PublicCatalogSort, string> = {
  position: "Recommended",
  newest: "Newest",
  name: "Name, A to Z",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
};

/** Pages to link to: the first, the last and the ones around the current page, with `null` for each gap. */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const wanted = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

export const totalPagesOf = (p: Pick<PublicCatalogProductPage, "total" | "limit">) => Math.max(1, Math.ceil(p.total / Math.max(1, p.limit)));

/** A catalog product as the storefront's product cards read it. The part number rides along; cards that do not know it ignore it. */
export function toCardProduct(p: PublicCatalogProduct) {
  return {
    name: p.name,
    slug: p.slug,
    short_description: p.shortDescription,
    price_minor: p.priceMinor,
    compare_at_price_minor: p.compareAtPriceMinor,
    image_path: p.imagePath,
    available: p.available,
    part_number: p.partNumber,
  };
}

const levelAfter = (levels: PublicCatalogLevel[], position: number) => levels.find((l) => l.position === position + 1)?.name ?? null;

/** The top of the catalog from the tree (read with `maxDepth=1`), or `unavailable` for a store with no published catalog. */
export function rootRenderData(tree: PublicCatalogTree, query: CatalogQuery): CatalogRenderData {
  if (!tree.hierarchy) return { view: "unavailable", hierarchyName: null, levels: [], node: null, breadcrumbs: [], children: [], childLevelName: null, products: null, query };
  const top = tree.nodes.filter((n) => n.depth === 1).sort((a, b) => a.position - b.position);
  return { view: "root", hierarchyName: tree.hierarchy.name, levels: tree.levels, node: null, breadcrumbs: [], children: top, childLevelName: top.length > 0 ? (tree.levels[0]?.name ?? null) : null, products: null, query };
}

/** One item with its breadcrumbs, children and a page of products. `levels` comes from the tree, to name the level of the children. */
export function nodeRenderData(page: PublicCatalogNodePage, levels: PublicCatalogLevel[], query: CatalogQuery): CatalogRenderData {
  return {
    view: "node",
    hierarchyName: page.hierarchy.name,
    levels,
    node: page.node,
    breadcrumbs: page.breadcrumbs,
    children: page.children,
    childLevelName: page.children.length > 0 ? levelAfter(levels, page.node.level.position) : null,
    products: page.products,
    query,
  };
}
