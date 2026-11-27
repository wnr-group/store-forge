import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string; className?: string }) => h("img", { src: p.src, alt: p.alt, className: p.className }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

import { CATALOG_SKINS } from "@/components/storefront/catalog/skins";
import { CatalogSection } from "@/components/storefront/engine/sections/catalog";
import { SECTION_COMPONENTS } from "@/components/storefront/engine/sections";
import { LOOK_IDS } from "@/lib/templates/looks";
import type { PublicCatalogLevel, PublicCatalogNode, PublicCatalogNodePage, PublicCatalogTree } from "@/lib/catalog/public-types";
import { catalogDocument } from "@/lib/storefront/documents";
import { catalogHref, catalogQueryHref, catalogSegments, nodeRenderData, pageWindow, parseCatalogQuery, rootRenderData, toCardProduct, totalPagesOf, type CatalogRenderData } from "@/lib/storefront/catalog";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const levels: PublicCatalogLevel[] = [
  { id: "L1", name: "Brand", position: 1, canHoldProducts: false },
  { id: "L2", name: "Vehicle", position: 2, canHoldProducts: false },
  { id: "L3", name: "Part group", position: 3, canHoldProducts: true },
];
const pnode = (name: string, path: string, over: Partial<PublicCatalogNode> = {}): PublicCatalogNode => ({
  id: path,
  parentId: null,
  levelId: "L1",
  name,
  slug: path.split("/").at(-1)!,
  path,
  description: null,
  position: 0,
  depth: path.split("/").length,
  hasChildren: true,
  productCount: 0,
  ...over,
});
const tree = (over: Partial<PublicCatalogTree> = {}): PublicCatalogTree => ({
  store: { name: "PRJ", slug: "prj", currency: "INR" },
  hierarchy: { id: "h", name: "Parts catalog" },
  levels,
  nodes: [pnode("Mahindra", "mahindra"), pnode("Suzuki", "suzuki"), pnode("Gusto", "suzuki/gusto", { depth: 2 })],
  truncated: false,
  ...over,
});
const product = (i: number, partNumber: string | null = `PN-${i}`) => ({ name: `Brake pad ${i}`, slug: `brake-pad-${i}`, partNumber, shortDescription: "Front, pair", priceMinor: 25000, compareAtPriceMinor: null, imagePath: null, available: true });
const nodePage = (over: Partial<PublicCatalogNodePage> = {}): PublicCatalogNodePage => ({
  store: { name: "PRJ", slug: "prj", currency: "INR" },
  hierarchy: { id: "h", name: "Parts catalog" },
  node: { ...pnode("Brakes", "mahindra/centuro/brakes", { depth: 3, hasChildren: false, productCount: 2, description: "Everything that stops it." }), level: levels[2] },
  breadcrumbs: [
    { id: "m", name: "Mahindra", slug: "mahindra", path: "mahindra", depth: 1, levelId: "L1", levelName: "Brand" },
    { id: "c", name: "Centuro", slug: "centuro", path: "mahindra/centuro", depth: 2, levelId: "L2", levelName: "Vehicle" },
    { id: "b", name: "Brakes", slug: "brakes", path: "mahindra/centuro/brakes", depth: 3, levelId: "L3", levelName: "Part group" },
  ],
  children: [],
  products: { items: [product(1), product(2, null)], page: 1, limit: 24, total: 2, includeDescendants: false },
  ...over,
});

const theme = (look?: string) => (look ? { settings: { brand: { look } } } : undefined);
const html = (data: CatalogRenderData, look?: string) =>
  renderToStaticMarkup(createElement(CatalogSection, { node: { type: "catalog", settings: {}, blocks: {}, block_order: [] } as never, context: { store: { name: "PRJ", slug: "prj", currency: "INR" }, theme: theme(look), mode: "public", catalog: data } as never }));
const q = { page: 1, sort: "position" as const, all: false };

describe("catalog addresses and queries", () => {
  it("accepts item slugs only, any depth up to twenty, and nothing that could reach another route", () => {
    expect(catalogSegments(undefined)).toEqual([]);
    expect(catalogSegments(["Mahindra", "centuro-2"])).toEqual(["mahindra", "centuro-2"]);
    for (const bad of [[""], ["a b"], ["a/b"], [".."], ["a_b"], ["-a"], ["a".repeat(81)], Array(21).fill("a")]) expect(catalogSegments(bad)).toBeNull();
    expect(catalogSegments(Array(20).fill("a"))).toHaveLength(20);
  });

  it("builds addresses under /catalog", () => {
    expect(catalogHref()).toBe("/catalog");
    expect(catalogHref("mahindra/centuro")).toBe("/catalog/mahindra/centuro");
  });

  it("reads page, sort and include-all, and falls back to the default for anything unusable", () => {
    expect(parseCatalogQuery({})).toEqual({ page: 1, sort: "position", all: false });
    expect(parseCatalogQuery({ page: "3", sort: "price_asc", all: "1" })).toEqual({ page: 3, sort: "price_asc", all: true });
    expect(parseCatalogQuery({ page: ["2", "9"], sort: ["name"] })).toMatchObject({ page: 2, sort: "name" });
    for (const page of ["0", "-1", "1.5", "abc", "100001", ""]) expect(parseCatalogQuery({ page }).page).toBe(1);
    expect(parseCatalogQuery({ sort: "DROP TABLE" }).sort).toBe("position");
    expect(parseCatalogQuery({ all: "true" }).all).toBe(false);
  });

  it("keeps a plain address plain and writes only the choices that differ from the defaults", () => {
    expect(catalogQueryHref("/catalog/a", {})).toBe("/catalog/a");
    expect(catalogQueryHref("/catalog/a", { page: 1, sort: "position", all: false })).toBe("/catalog/a");
    expect(catalogQueryHref("/catalog/a", { page: 2, sort: "name", all: true })).toBe("/catalog/a?sort=name&all=1&page=2");
  });

  it("lists the pages around the current one with gaps, and every page for a short list", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20]);
    expect(totalPagesOf({ total: 0, limit: 24 })).toBe(1);
    expect(totalPagesOf({ total: 25, limit: 24 })).toBe(2);
  });

  it("maps a catalog product to the card shape and carries the part number", () => {
    expect(toCardProduct(product(1))).toMatchObject({ name: "Brake pad 1", slug: "brake-pad-1", short_description: "Front, pair", price_minor: 25000, part_number: "PN-1", available: true });
  });
});

describe("catalog render data", () => {
  it("is unavailable for a store with no published catalog", () => {
    expect(rootRenderData(tree({ hierarchy: null, levels: [], nodes: [] }), q)).toMatchObject({ view: "unavailable", children: [] });
  });

  it("shows the top level at the root, named by the first level, in display order", () => {
    const d = rootRenderData(tree({ nodes: [pnode("Suzuki", "suzuki", { position: 1 }), pnode("Mahindra", "mahindra", { position: 0 }), pnode("Gusto", "suzuki/gusto", { depth: 2 })] }), q);
    expect(d.view).toBe("root");
    expect(d.children.map((c) => c.name)).toEqual(["Mahindra", "Suzuki"]);
    expect(d.childLevelName).toBe("Brand");
  });

  it("names the level of the children of an item from the levels of the catalog, whatever their number", () => {
    const withKids = nodePage({ children: [pnode("Disc", "mahindra/centuro/brakes/disc", { depth: 4 })], node: { ...nodePage().node, level: levels[1] } });
    expect(nodeRenderData(withKids, levels, q).childLevelName).toBe("Part group");
    expect(nodeRenderData(nodePage(), levels, q).childLevelName).toBeNull();
    const seventh = { ...levels[1], position: 7, name: "Seventh" };
    const deep = { ...withKids, node: { ...withKids.node, level: seventh } };
    expect(nodeRenderData(deep, [seventh, { ...levels[0], position: 8, name: "Eighth" }], q).childLevelName).toBe("Eighth");
  });
});

describe("the catalog page in every template", () => {
  it("is registered once, for every template, as a generated page and not an editor section", () => {
    expect(SECTION_COMPONENTS.catalog).toBe(CatalogSection);
    expect(catalogDocument().order).toEqual(["catalog"]);
    expect(catalogDocument().sections.catalog.type).toBe("catalog");
  });

  it("has a skin for every look, so a new template cannot be left without the catalog", () => {
    expect(Object.keys(CATALOG_SKINS).sort()).toEqual([...LOOK_IDS].sort());
  });

  it("draws nothing without catalog data", () => {
    expect(renderToStaticMarkup(createElement(CatalogSection, { node: {} as never, context: { store: { name: "PRJ", slug: "p", currency: "INR" }, mode: "public" } as never }))).toBe("");
  });

  for (const look of [undefined, "standard", "boutique", "sport", "market"]) {
    describe(`look: ${look ?? "(none)"}`, () => {
      it("shows the top of the catalog: a title, the first level's name and a link for each item", () => {
        const out = html(rootRenderData(tree(), q), look);
        expect(out).toContain("Parts catalog");
        expect(out).toContain("Shop by Brand");
        expect(out).toContain('href="/catalog/mahindra"');
        expect(out).toContain('href="/catalog/suzuki"');
        expect(out).not.toContain("suzuki/gusto"); // only the top level at the root
        expect(out).toContain('aria-label="Breadcrumb"');
      });

      it("shows an item: breadcrumbs back up every step, its description, and its parts with their part numbers", () => {
        const out = html(nodeRenderData(nodePage(), levels, q), look);
        expect(out).toContain('href="/catalog/mahindra"');
        expect(out).toContain('href="/catalog/mahindra/centuro"');
        expect(out).toContain("Everything that stops it.");
        expect(out).toContain("Brake pad 1");
        expect(out).toContain("PN-1");
        expect(out).toContain('href="/products/brake-pad-1"');
        expect(out).toContain("Sort parts");
        expect(out).not.toContain("Part no. <span class=\"font-mono text-foreground\">null");
      });

      it("shows the items one step down as links and names their level", () => {
        const page = nodePage({ node: { ...nodePage().node, level: levels[1] }, children: [pnode("Front", "mahindra/centuro/front", { depth: 3, productCount: 3 })], products: { items: [], page: 1, limit: 24, total: 0, includeDescendants: false } });
        const out = html(nodeRenderData(page, levels, q), look);
        expect(out).toContain('href="/catalog/mahindra/centuro/front"');
        expect(out).toContain("Browse by Part group");
        expect(out).toContain("3 parts");
      });

      it("paginates and keeps the sort in every page link", () => {
        const page = nodePage({ products: { items: [product(1)], page: 2, limit: 24, total: 100, includeDescendants: false } });
        const out = html(nodeRenderData(page, levels, { page: 2, sort: "price_asc", all: false }), look);
        expect(out).toContain('rel="prev"');
        expect(out).toContain('rel="next"');
        expect(out).toContain("/catalog/mahindra/centuro/brakes?sort=price_asc&amp;page=3");
        expect(out).toContain('aria-current="page"');
      });

      it("says so when there is nothing yet, at the top and inside an item", () => {
        expect(html(rootRenderData(tree({ nodes: [] }), q), look)).toContain("has not added anything");
        const empty = nodePage({ products: { items: [], page: 1, limit: 24, total: 0, includeDescendants: false } });
        expect(html(nodeRenderData(empty, levels, q), look)).toContain("nothing here yet");
      });

      it("offers the products of the groups below when none sit directly on the item", () => {
        const page = nodePage({ node: { ...nodePage().node, hasChildren: true, level: levels[1] }, children: [pnode("Front", "mahindra/centuro/brakes/front", { depth: 4 })], products: { items: [], page: 1, limit: 24, total: 0, includeDescendants: false } });
        expect(html(nodeRenderData(page, levels, q), look)).toContain("all=1");
      });
    });
  }
});
