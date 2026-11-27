import { z } from "zod";

/**
 * Input of the catalog hierarchy server actions. Server actions receive arbitrary client data, so each action parses it here
 * first; the API validates again and owns the business rules. Limits mirror the API's DTOs (catalog-hierarchy.dto.ts).
 */

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} can have at most ${max} characters.`);

/** Absent stays absent (an update must not clear what the form did not send); an empty text clears the value (null). */
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} can have at most ${max} characters.`)
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "" ? null : v));

export const catalogStatusSchema = z.enum(["draft", "active"], { error: "Choose draft or active." });

export const hierarchyInputSchema = z.object({ name: text("Catalog name", 80), status: catalogStatusSchema.optional() });
export const hierarchyUpdateSchema = z.object({ name: text("Catalog name", 80).optional(), status: catalogStatusSchema.optional() });

export const levelCreateSchema = z.object({ name: text("Level name", 60), canHoldProducts: z.boolean().optional(), position: z.number().int().min(1).max(20).optional() });
export const levelUpdateSchema = z.object({ name: text("Level name", 60).optional(), canHoldProducts: z.boolean().optional() });

/** An address segment: lowercase letters, numbers and single hyphens. Empty means "make one from the name". */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(80, "The address can have at most 80 characters.")
  .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
  .optional()
  .transform((v) => (v ? v : undefined));

export const nodeCreateSchema = z.object({
  name: text("Name", 120),
  slug,
  parentId: z.uuid().nullable().optional(),
  description: optionalText("Description", 2000),
  status: catalogStatusSchema.optional(),
  seoTitle: optionalText("SEO title", 70),
  seoDescription: optionalText("SEO description", 160),
});

export const nodeUpdateSchema = z.object({
  name: text("Name", 120).optional(),
  slug,
  description: optionalText("Description", 2000),
  status: catalogStatusSchema.optional(),
  seoTitle: optionalText("SEO title", 70),
  seoDescription: optionalText("SEO description", 160),
});

export const nodeMoveSchema = z.object({ parentId: z.uuid().nullable(), position: z.number().int().min(0).max(1_000_000).optional() });

const ids = (max: number, label: string) => z.array(z.uuid()).min(1, `Choose at least one ${label}.`).max(max, `Choose at most ${max} ${label}s at once.`);

export const productIdsSchema = ids(500, "product");
export const nodeIdsSchema = z.array(z.uuid()).max(5000);

export const bulkAssignmentSchema = z
  .object({ action: z.enum(["assign", "unassign"]), nodeIds: ids(100, "item"), productIds: ids(500, "product") })
  .refine((v) => v.nodeIds.length * v.productIds.length <= 20_000, { message: "Choose fewer items or products: at most 20000 placements at once." });

export const placementSetSchema = z.array(z.uuid()).max(200, "A product can be placed on at most 200 items.");

export const nodeListSchema = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  parentId: z.union([z.literal("root"), z.uuid()]).optional(),
  levelId: z.uuid().optional(),
  status: z.enum(["draft", "active", "all"]).optional(),
});

export const nodeProductsListSchema = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  includeDescendants: z.boolean().optional(),
});

export const productSearchSchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.number().int().min(1).max(100_000).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

/** Import rows are produced by our own parser and validated again, row by row, by the API; here only the envelope is checked. */
const importRow = z.object({ row: z.number().int().min(2) }).catchall(z.union([z.string(), z.number(), z.array(z.object({ column: z.string(), message: z.string() }))]));
const importLevel = z.object({ row: z.number().int().min(2), name: z.string().max(100).optional(), can_hold_products: z.string().max(20).optional() });

export const importRequestSchema = z.object({
  dryRun: z.boolean().optional(),
  hierarchyName: z.string().trim().max(80).optional(),
  defaultStatus: catalogStatusSchema.optional(),
  levels: z.array(importLevel).max(20).optional(),
  rows: z.array(importRow).min(1).max(2000),
});
