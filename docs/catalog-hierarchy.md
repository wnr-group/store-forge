# Catalog hierarchy (frontend)

A store owner describes the catalog as a tree with **any number of named levels**, for example `Brand > Vehicle > Variant > Part group`,
and places products on its items. One product can sit on many items (nothing is copied). Categories and collections are **not** changed:
this is a separate structure. The data model, rules and endpoints are owned by `store-forge-api` (its `docs/CATALOG_HIERARCHY.md` is the
contract of record); this page describes how the frontend uses them.

Nothing in the frontend knows how many levels a store has or what they are called. The five levels of the first customer (Brand, Vehicle,
Variant, Part category, Parts) are one configuration, never code.

## Where things are

| Part | Files |
|---|---|
| Models (plain types, safe in the browser) | `lib/catalog/types.ts` (manager side), `lib/catalog/public-types.ts` (public side) |
| Pure tree helpers | `lib/catalog/tree.ts` |
| API calls | `lib/api/endpoints/catalog-api.ts` (`/catalog/*`), `lib/api/endpoints/public-catalog-api.ts` (public) |
| Service (permission first, then one API call) | `services/catalog.service.ts`; the storefront page in `services/storefront.service.ts` (`getPublishedCatalogPage`) |
| Server actions | `app/(dashboard)/dashboard/catalog/actions.ts` |
| Dashboard | `app/(dashboard)/dashboard/catalog/` (page, `loading.tsx`, `import/`, `export/route.ts`), `components/catalog/` |
| Part number | product form, table, import, export, product page (see below) |
| Import / export | `lib/import/parse-catalog-file.ts`, `catalog-columns.ts`, `catalog-aggregate.ts`, `xlsx-writer.ts`, `export-file.ts` |
| Storefront route | `app/s/[slug]/catalog/[[...path]]/` (`page.tsx`, `loading.tsx`, `error.tsx`) |
| Storefront drawing | `components/storefront/catalog/` (`catalog-view.tsx`, `skins.tsx`), engine section `components/storefront/engine/sections/catalog.tsx` |

## Dashboard (Catalog > Catalog hierarchy)

Needs `catalog:view` to open; `catalog:manage` to change; `catalog:delete` to delete (same as products and categories).

- **Set up**: the first screen creates the catalog (a draft). **Make live** / **Hide from shoppers** switches its status. Shoppers see
  nothing of a draft catalog, and nothing below a draft item.
- **Levels**: add (at the end, or before a level), rename, say which levels may carry products, reorder with the arrows, delete an empty
  level. The API refuses an order that would break existing items and lists the reasons (`details.problems`), which the screen shows.
- **Items**: a tree (as deep as the levels), with create, edit, delete (with its subtree after typing its name), move to another valid
  parent, and reorder among siblings. A search box reads `GET /catalog/nodes` a page at a time for large catalogs.
- **Products on items**: per item (a side sheet: search, add, take off, include products of the items below), in bulk (many products on many
  items, all or nothing) and per product (a card on the product page). Only items whose level may carry products are offered.
- **Part number**: see below.

## Import and export

Files are read **on the server** (`parseCatalogFileAction`: CSV or `.xlsx`, up to 1 MB and 10000 rows, with the same zip, sparse-sheet and
formula-cell safeguards as the product import), and the rows go to `POST /catalog/import` as JSON in requests of at most 2000 rows
(about 1.2 MB). The page keeps the parsed rows, so a preview and the real import use one parse.

1. **Check file** sends every request with `dryRun: true` and shows what would be created or left alone, and every problem
   (`row`, `column`, `message`, `value`), with a downloadable error report.
2. **Import** is enabled only for a valid file. The API validates a real request against the database and writes it all or nothing; a file
   of several requests is sent in order, each one idempotent.
3. Because the requests of a large file are checked on their own, the preview counts a parent shared by two requests twice; the import
   itself is exact. The page says so.

File format: one row per item (`level_1` ... `level_20`, the row is about the last filled one), optional `status`, `description`,
`position`, and one product to place by `product_sku`, `product_slug` or `product_id`. A part number alone never identifies a product (it is
not unique). Levels come from the catalog, a sheet named `Levels` (second sheet of a workbook), or an optional levels file.

Exports: `/dashboard/catalog/export?format=xlsx|csv[&part=levels]` and `/dashboard/products/export?format=xlsx|csv[&status=]` page through
the API (at most 100 pages of 1000 rows) and write the file; the Excel export has the items on the first sheet and `Levels` on the second,
so it imports again unchanged. The `.xlsx` is written by `lib/import/xlsx-writer.ts` (Node's zlib, no package).

## Part number

`products.part_number` is optional, **not unique**, at most 64 characters, and never replaces the SKU. It is on the product form, the product
list (under the SKU), the product import (`part_number`) and export, the storefront product page (beside the SKU in every look) and the
catalog part cards. The product export also writes `id` and `has_variants`; the product import accepts and ignores them and flags a row
whose `has_variants` is true (the import only creates simple products).

## Storefront

One route and one data shape for **every** template:

- `/catalog` is the top of the catalog; `/catalog/<item>/<item>/...` is one item at any depth. The page, sort and "include sub-groups"
  choices are `?page=&sort=&all=1`. A store without a published catalog, and an item that does not exist or is not public, are a 404.
- `getPublishedCatalogPage` reads the published design for the store's theme, header and footer (and falls back to the engine's defaults when
  none is published, so the catalog works before and without any design), plus one cached tree read (`maxDepth=1`) and, for an item, one
  item read. Public reads are anonymous and cached under the store's own tag, so a dashboard change shows on the next page.
- The page is the generated document `catalogDocument()` (`catalog` section). The section is registered once in `SECTION_COMPONENTS`, reads
  `RenderContext.catalog` and fetches nothing. It is not an editor section.
- **Per-template look**: `CATALOG_SKINS` (`Record<LookId, CatalogSkin>`) gives each look its own wrapper, headings, breadcrumb and tiles,
  reusing that look's own building blocks, and each look's own **product card** (`StorefrontLook.card`) draws the parts. The type makes the
  compiler fail when a look is added without a skin. A store that changes template keeps its catalog: it is store data, not theme data.
- Breadcrumbs, children as tiles (named by their level), products with part number, sorting, pagination, and empty, loading (`loading.tsx`) and
  error (`error.tsx`) states.
- **Navigation**: the menu is part of the theme, so a link is the owner's choice. The Navigation editor offers "Catalog: ..." links
  (the catalog and its top-level items) once the catalog is live. `catalog` is a reserved page address.

## Limits and known gaps

- Items have no pictures (the API has no upload area for them yet); tiles are text.
- The public API does not return the other items a product sits on, so the product page shows no "fits" list. The dashboard does show it.
- Reordering the products of an item is available in the API but not in the dashboard (the order is the order they were added).
- The part-number label on the storefront is fixed text ("Part no."); it is not part of the editable shopping wording.
- The two built-in templates used by a store with no published design (`classic`, `spotlight`) do not link to the catalog; its page works.
- The preview of a multi-request import can count a shared parent twice (see above).
