import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { rowsOf, withPublicContext } from "@/lib/db/user-context";
import { migrateDocument } from "@/lib/templates/engine/migrate";
import { assertEngineReadsEnabled, EngineReadsDisabledError } from "@/services/engine-cutover.service";
import { themeToCssVars, type ThemeSettings } from "@/lib/templates/engine/theme-css";
import { classicPreset, collectionPreset, productPreset } from "@/lib/templates/presets";
import type { TemplateDocument, TemplateKind } from "@/lib/templates/document";
import type {
  CollectionDetailData,
  CollectionSummary,
  ProductDetailData,
  RenderContext,
} from "@/components/storefront/engine/types";

// =============================================================================
// Payload Zod Schemas for Public Database Functions (AC-SF-014, AC-DB-016)
// =============================================================================

const layoutPayloadSchema = z.object({
  source: z.enum(["assigned", "default"]).nullable().optional(),
  template: z
    .object({
      name: z.string(),
      version_number: z.number().int(),
      document: z.record(z.string(), z.unknown()),
    })
    .nullable()
    .optional(),
  theme: z.record(z.string(), z.unknown()).nullable().optional(),
  groups: z
    .object({
      header: z.record(z.string(), z.unknown()).nullable().optional(),
      footer: z.record(z.string(), z.unknown()).nullable().optional(),
      announcement: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .default({}),
});

const publicStoreSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logo_path: z.string().nullable().optional(),
  currency: z.string().default("INR"),
  products: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string(),
        short_description: z.string().nullable().optional(),
        price_minor: z.number(),
        compare_at_price_minor: z.number().nullable().optional(),
        image_path: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const publicProductPayloadSchema = z.object({
  store: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    logo_path: z.string().nullable().optional(),
    currency: z.string().default("INR"),
  }),
  product: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    short_description: z.string().nullable().optional(),
    product_type: z.string().nullable().optional(),
    sku: z.string().nullable().optional(),
    price_minor: z.number(),
    compare_at_price_minor: z.number().nullable().optional(),
    has_variants: z.boolean().default(false),
    category_name: z.string().nullable().optional(),
  }),
  images: z
    .array(
      z.object({
        id: z.string(),
        path: z.string(),
        alt: z.string().nullable().optional(),
        position: z.number().default(0),
        is_primary: z.boolean().default(false),
      }),
    )
    .default([]),
  options: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.string()),
      }),
    )
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        options: z.record(z.string(), z.string()).or(z.record(z.string(), z.unknown())).default({}),
        sku: z.string().nullable().optional(),
        price_minor: z.number(),
        compare_at_price_minor: z.number().nullable().optional(),
        image_id: z.string().nullable().optional(),
      }),
    )
    .default([]),
  related: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string(),
        short_description: z.string().nullable().optional(),
        price_minor: z.number(),
        compare_at_price_minor: z.number().nullable().optional(),
        image_path: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const publicCollectionPayloadSchema = z.object({
  store: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    logo_path: z.string().nullable().optional(),
    currency: z.string().default("INR"),
  }),
  collection: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    image_path: z.string().nullable().optional(),
  }),
  products: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string(),
        short_description: z.string().nullable().optional(),
        price_minor: z.number(),
        compare_at_price_minor: z.number().nullable().optional(),
        image_path: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const publicCollectionsListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    image_path: z.string().nullable().optional(),
    product_count: z.number().default(0),
  }),
);

// =============================================================================
// PageData Return Contract (D17, D19, AC-SF-001..020)
// =============================================================================

export interface PageData {
  kind: TemplateKind;
  source: "assigned" | "default" | "registry";
  document: TemplateDocument;
  layoutKey: string;
  store: z.infer<typeof publicStoreSchema>;
  resource?: ProductDetailData | CollectionDetailData | null;
  collections?: CollectionSummary[];
  theme?: Record<string, unknown> | null;
  themeCss?: string;
  faviconPath?: string | null;
  groups?: {
    header?: TemplateDocument | null;
    footer?: TemplateDocument | null;
    announcement?: TemplateDocument | null;
  };
}

/** Check if a document tree contains sections that need the store collection list */
function needsCollectionsList(doc: TemplateDocument): boolean {
  if (!doc.sections) return false;
  return Object.values(doc.sections).some(
    (sec) => sec.type === "collection-list" || sec.type === "featured-collection",
  );
}

/**
 * Loads full published storefront page data (AC-SF-001..020).
 * Issues in parallel <= 3 round trips to public database functions:
 *  1. get_public_template_layout
 *  2. resource/storefront query (get_public_storefront, get_public_product, or get_public_collection)
 *  3. (Optional) get_public_collections when collection-list or featured-collection section is present.
 */
export async function loadStorefrontPage(
  kind: "index" | "product" | "collection",
  storeSlug: string,
  resourceSlug?: string,
): Promise<PageData | null> {
  // Fail-closed cutover gate: nothing below runs (and no template engine table is read) until the persisted marker says complete.
  await assertEngineReadsEnabled();
  return loadEnginePage(kind, storeSlug, resourceSlug);
}

/** Pages that did not exist before the cutover (products, collections): behaves as "not found" while the gate is closed. */
export async function loadStorefrontPageIfEnabled(
  kind: "index" | "product" | "collection",
  storeSlug: string,
  resourceSlug?: string,
): Promise<PageData | null> {
  try {
    return await loadStorefrontPage(kind, storeSlug, resourceSlug);
  } catch (e) {
    if (e instanceof EngineReadsDisabledError) return null;
    throw e;
  }
}

async function loadEnginePage(
  kind: "index" | "product" | "collection",
  storeSlug: string,
  resourceSlug?: string,
): Promise<PageData | null> {
  const cleanSlug = storeSlug?.trim().toLowerCase();
  if (!cleanSlug) return null;

  const db = getDatabase();

  return withPublicContext(db, async (tx) => {
    // Parallel Batch: layout query + resource/storefront query (<=2 parallel round trips)
    const layoutPromise = tx.execute(
      sql`select public.get_public_template_layout(${cleanSlug}, ${kind}, ${resourceSlug ?? null}) as l`,
    );

    const resourcePromise =
      kind === "index"
        ? tx.execute(sql`select public.get_public_storefront(${cleanSlug}) as s`)
        : kind === "product"
          ? tx.execute(sql`select public.get_public_product(${cleanSlug}, ${resourceSlug ?? ""}) as p`)
          : tx.execute(sql`select public.get_public_collection(${cleanSlug}, ${resourceSlug ?? ""}) as c`);

    const [layoutRes, resourceRes] = await Promise.all([layoutPromise, resourcePromise]);

    const rawLayout = rowsOf<{ l: unknown }>(layoutRes)[0]?.l;
    if (rawLayout === null || rawLayout === undefined) {
      // Store does not exist, is inactive, or is suspended -> HTTP 404
      return null;
    }

    const layoutParsed = layoutPayloadSchema.parse(
      typeof rawLayout === "string" ? JSON.parse(rawLayout) : rawLayout,
    );

    let storeData: z.infer<typeof publicStoreSchema>;
    let resourceData: ProductDetailData | CollectionDetailData | null = null;

    if (kind === "index") {
      const rawStore = rowsOf<{ s: unknown }>(resourceRes)[0]?.s;
      if (rawStore === null || rawStore === undefined) return null;
      storeData = publicStoreSchema.parse(
        typeof rawStore === "string" ? JSON.parse(rawStore) : rawStore,
      );
    } else if (kind === "product") {
      const rawProduct = rowsOf<{ p: unknown }>(resourceRes)[0]?.p;
      if (rawProduct === null || rawProduct === undefined) return null;
      const parsed = publicProductPayloadSchema.parse(
        typeof rawProduct === "string" ? JSON.parse(rawProduct) : rawProduct,
      );
      storeData = { ...parsed.store, products: [] };
      resourceData = {
        name: parsed.product.name,
        slug: parsed.product.slug,
        description: parsed.product.description,
        short_description: parsed.product.short_description,
        type: parsed.product.product_type,
        sku: parsed.product.sku,
        price_minor: parsed.product.price_minor,
        compare_at_price_minor: parsed.product.compare_at_price_minor,
        category: parsed.product.category_name,
        has_variants: parsed.product.has_variants,
        images: parsed.images.map((i) => i.path),
        image_path: parsed.images[0]?.path ?? null,
        options: parsed.options.map((o) => ({
          id: o.name,
          name: o.name,
          values: o.values,
        })),
        variants: parsed.variants.map((v) => ({
          id: v.id,
          title: v.title,
          price_minor: v.price_minor,
          compare_at_price_minor: v.compare_at_price_minor,
          sku: v.sku,
          image_path: parsed.images.find((i) => i.id === v.image_id)?.path ?? null,
          option_values: (v.options ?? {}) as Record<string, string>,
        })),
        related: parsed.related,
      } as ProductDetailData;
    } else {
      const rawColl = rowsOf<{ c: unknown }>(resourceRes)[0]?.c;
      if (rawColl === null || rawColl === undefined) return null;
      const parsed = publicCollectionPayloadSchema.parse(
        typeof rawColl === "string" ? JSON.parse(rawColl) : rawColl,
      );
      storeData = { ...parsed.store, products: parsed.products };
      resourceData = {
        id: parsed.collection.id,
        name: parsed.collection.name,
        slug: parsed.collection.slug,
        description: parsed.collection.description,
        image_path: parsed.collection.image_path,
        products: parsed.products,
      } as CollectionDetailData;
    }

    // Resolve Fallback Chain (AC-SF-010):
    // 1. assigned -> 2. default -> 3. registry
    let source: "assigned" | "default" | "registry" = "registry";
    let document: TemplateDocument;

    if (layoutParsed.template?.document) {
      source = layoutParsed.source ?? "default";
      document = migrateDocument(
        kind,
        layoutParsed.template.document,
      );
    } else {
      source = "registry";
      document = (
        kind === "product"
          ? productPreset
          : kind === "collection"
            ? collectionPreset
            : classicPreset
      ) as TemplateDocument;
    }

    // Optional 3rd Query: get_public_collections if sections need collections list (AC-SF-014, AC-SF-016)
    let collectionsList: CollectionSummary[] | undefined = undefined;
    if (needsCollectionsList(document)) {
      const collRes = await tx.execute(
        sql`select public.get_public_collections(${cleanSlug}) as cols`,
      );
      const rawCols = rowsOf<{ cols: unknown }>(collRes)[0]?.cols;
      if (rawCols) {
        collectionsList = publicCollectionsListSchema.parse(
          typeof rawCols === "string" ? JSON.parse(rawCols) : rawCols,
        );
      }
    }

    // Theme & CSS Variables (AC-SF-009)
    const rawTheme = layoutParsed.theme;
    const themeSettings: ThemeSettings | null = rawTheme
      ? (rawTheme.settings as ThemeSettings) ?? (rawTheme as ThemeSettings)
      : null;
    const themeCss = themeSettings ? themeToCssVars(themeSettings) : "";

    // Favicon (AC-SF-015)
    let faviconPath: string | null = null;
    if (rawTheme) {
      const brand = (rawTheme.brand ?? rawTheme) as Record<string, unknown>;
      const fav = (rawTheme.favicon ?? brand?.favicon) as
        | { path?: string }
        | string
        | null
        | undefined;
      if (typeof fav === "string" && fav.trim()) {
        faviconPath = fav.trim();
      } else if (fav && typeof fav === "object" && typeof fav.path === "string") {
        faviconPath = fav.path.trim();
      }
    }

    // Groups (AC-SF-008)
    const groups = {
      header: layoutParsed.groups?.header
        ? migrateDocument(
            "group_header",
            layoutParsed.groups.header,
          )
        : null,
      footer: layoutParsed.groups?.footer
        ? migrateDocument(
            "group_footer",
            layoutParsed.groups.footer,
          )
        : null,
      announcement: layoutParsed.groups?.announcement
        ? migrateDocument(
            "group_announcement",
            layoutParsed.groups.announcement,
          )
        : null,
    };

    return {
      kind,
      source,
      document,
      layoutKey: document.layout ?? "classic",
      store: storeData,
      resource: resourceData,
      collections: collectionsList,
      theme: rawTheme ?? null,
      themeCss,
      faviconPath,
      groups,
    };
  });
}

/**
 * Builds standard RenderContext for <TemplateRenderer /> from PageData.
 */
export function buildRenderContext(
  pageData: PageData,
  basePath?: string,
): RenderContext {
  return {
    store: pageData.store,
    resource: pageData.resource ?? undefined,
    collections: pageData.collections,
    theme: pageData.theme ?? undefined,
    groupHeader: pageData.groups?.header ?? undefined,
    groupFooter: pageData.groups?.footer ?? undefined,
    groupAnnouncement: pageData.groups?.announcement ?? undefined,
    basePath,
    mode: "public",
  };
}
