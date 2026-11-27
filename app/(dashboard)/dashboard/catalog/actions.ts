"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseCatalogFile, type CatalogParseOutcome } from "@/lib/import/parse-catalog-file";
import { invalidateStorefront } from "@/lib/storefront/cache";
import { requireActiveTenant } from "@/lib/tenant/context";
import {
  bulkAssignmentSchema,
  hierarchyInputSchema,
  hierarchyUpdateSchema,
  importRequestSchema,
  levelCreateSchema,
  levelUpdateSchema,
  nodeCreateSchema,
  nodeIdsSchema,
  nodeListSchema,
  nodeMoveSchema,
  nodeProductsListSchema,
  nodeUpdateSchema,
  placementSetSchema,
  productIdsSchema,
  productSearchSchema,
} from "@/lib/validations/catalog-hierarchy";
import { parseInput } from "@/lib/validations/parse";
import { AppError } from "@/lib/errors";
import {
  assignCatalogProducts,
  bulkCatalogAssignment,
  createCatalogHierarchy,
  createCatalogLevel,
  createCatalogNode,
  deleteCatalogLevel,
  deleteCatalogNode,
  getCatalogNode,
  getProductPlacements,
  importCatalogRows,
  listCatalogNodeProducts,
  listCatalogNodes,
  moveCatalogNode,
  reorderCatalogLevels,
  reorderCatalogNodeProducts,
  reorderCatalogNodes,
  searchProductsForCatalog,
  setProductPlacements,
  unassignCatalogProducts,
  updateCatalogHierarchy,
  updateCatalogLevel,
  updateCatalogNode,
} from "@/services/catalog.service";

/**
 * Server actions of the catalog hierarchy dashboard. Each one parses its input, calls the service (which checks the permission
 * and the API owns the rules) and drops the cached storefront, because what shoppers see just changed.
 */

const id = z.uuid();

const refresh = async () => {
  revalidatePath(ROUTES.catalog);
  revalidatePath(ROUTES.products);
  await invalidateStorefront();
};

// ------------------------------------------------------------------------------------------------------------------ hierarchy

export async function createHierarchyAction(input: unknown) {
  return run(
    async () => {
      const created = await createCatalogHierarchy(parseInput(hierarchyInputSchema, input));
      await refresh();
      return created;
    },
    { operation: "catalog.hierarchy.create" },
  );
}

export async function updateHierarchyAction(input: unknown) {
  return run(
    async () => {
      const values = parseInput(hierarchyUpdateSchema, input);
      const updated = await updateCatalogHierarchy(values);
      await refresh();
      return updated;
    },
    { operation: "catalog.hierarchy.update" },
  );
}

// ------------------------------------------------------------------------------------------------------------------ levels

export async function createLevelAction(input: unknown) {
  return run(async () => {
    const level = await createCatalogLevel(parseInput(levelCreateSchema, input));
    await refresh();
    return level;
  });
}

export async function updateLevelAction(levelId: unknown, input: unknown) {
  return run(async () => {
    const level = await updateCatalogLevel(parseInput(id, levelId), parseInput(levelUpdateSchema, input));
    await refresh();
    return level;
  });
}

/** Every level id in the new order. The API refuses an order that would break existing relations (409 with the reasons in `details.problems`). */
export async function reorderLevelsAction(levelIds: unknown) {
  return run(async () => {
    const levels = await reorderCatalogLevels(parseInput(z.array(z.uuid()).min(1).max(20), levelIds));
    await refresh();
    return levels;
  });
}

export async function deleteLevelAction(levelId: unknown) {
  return run(async () => {
    await deleteCatalogLevel(parseInput(id, levelId));
    await refresh();
  });
}

// ------------------------------------------------------------------------------------------------------------------ nodes

export async function createNodeAction(input: unknown) {
  return run(async () => {
    const node = await createCatalogNode(parseInput(nodeCreateSchema, input));
    await refresh();
    return node;
  });
}

export async function updateNodeAction(nodeId: unknown, input: unknown) {
  return run(async () => {
    const node = await updateCatalogNode(parseInput(id, nodeId), parseInput(nodeUpdateSchema, input));
    await refresh();
    return node;
  });
}

export async function moveNodeAction(nodeId: unknown, input: unknown) {
  return run(async () => {
    const node = await moveCatalogNode(parseInput(id, nodeId), parseInput(nodeMoveSchema, input));
    await refresh();
    return node;
  });
}

/** Every child of one parent (null = the top level) in the new order. */
export async function reorderNodesAction(parentId: unknown, nodeIds: unknown) {
  return run(async () => {
    await reorderCatalogNodes({ parentId: parseInput(id.nullable(), parentId), nodeIds: parseInput(nodeIdsSchema.min(1), nodeIds) });
    await refresh();
  });
}

export async function deleteNodeAction(nodeId: unknown, cascade: unknown) {
  return run(async () => {
    const result = await deleteCatalogNode(parseInput(id, nodeId), parseInput(z.boolean(), cascade));
    await refresh();
    return result;
  });
}

export async function getNodeAction(nodeId: unknown) {
  return run(async () => getCatalogNode(parseInput(id, nodeId)));
}

/** Search and paginate items (the tree is for browsing; this is for finding, and for the parent and item pickers). */
export async function listNodesAction(input: unknown) {
  return run(async () => {
    const q = parseInput(nodeListSchema, input);
    return listCatalogNodes({ ...q, sortBy: "name", sortOrder: "asc" });
  });
}

// ------------------------------------------------------------------------------------------------------------------ products

export async function listNodeProductsAction(nodeId: unknown, input: unknown) {
  return run(async () => listCatalogNodeProducts(parseInput(id, nodeId), parseInput(nodeProductsListSchema, input)));
}

export async function assignProductsAction(nodeId: unknown, productIds: unknown) {
  return run(async () => {
    const result = await assignCatalogProducts(parseInput(id, nodeId), parseInput(productIdsSchema, productIds));
    await refresh();
    return result;
  });
}

export async function unassignProductsAction(nodeId: unknown, productIds: unknown) {
  return run(async () => {
    const result = await unassignCatalogProducts(parseInput(id, nodeId), parseInput(productIdsSchema, productIds));
    await refresh();
    return result;
  });
}

export async function reorderNodeProductsAction(nodeId: unknown, productIds: unknown) {
  return run(async () => {
    await reorderCatalogNodeProducts(parseInput(id, nodeId), parseInput(productIdsSchema.max(5000), productIds));
    await refresh();
  });
}

export async function bulkAssignmentAction(input: unknown) {
  return run(async () => {
    const result = await bulkCatalogAssignment(parseInput(bulkAssignmentSchema, input));
    await refresh();
    return result;
  });
}

/** Where one product is placed (for the product page). */
export async function getProductPlacementsAction(productId: unknown) {
  return run(async () => getProductPlacements(parseInput(id, productId)));
}

/** Make a product sit on exactly these items (the others are removed). */
export async function setProductPlacementsAction(productId: unknown, nodeIds: unknown) {
  return run(async () => {
    const placements = await setProductPlacements(parseInput(id, productId), parseInput(placementSetSchema, nodeIds));
    await refresh();
    return placements;
  });
}

export async function searchProductsAction(input: unknown) {
  return run(async () => searchProductsForCatalog(parseInput(productSearchSchema, input)));
}

// ------------------------------------------------------------------------------------------------------------------ import

/**
 * Reads the uploaded CSV / Excel file and returns the rows (the file itself never goes to the API). Nothing is saved here.
 * The permission is checked before the file is read.
 */
export async function parseCatalogFileAction(formData: FormData) {
  return run(
    async (): Promise<Extract<CatalogParseOutcome, { ok: true }>> => {
      await requireActiveTenant("catalog:manage");
      const file = formData.get("file");
      if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to import.");
      const levelsFile = formData.get("levels");
      const parsed = await parseCatalogFile(file, levelsFile instanceof File && levelsFile.size > 0 ? levelsFile : null);
      if (!parsed.ok) throw new AppError("VALIDATION", "The file cannot be imported.", undefined, undefined, { kind: "file", errors: parsed.errors });
      return parsed;
    },
    { operation: "catalog.import.parse" },
  );
}

/**
 * One request of a catalog import: a dry run (preview) or the real thing. The page sends the rows in several requests when the
 * file is large (the API takes up to 2000 per request); every request is idempotent, and a real request with any problem changes nothing.
 */
export async function importCatalogChunkAction(input: unknown) {
  return run(
    async () => {
      const request = parseInput(importRequestSchema, input);
      try {
        const result = await importCatalogRows(request as Parameters<typeof importCatalogRows>[0]);
        if (!request.dryRun) await refresh();
        return result;
      } catch (e) {
        // The API's 400 CATALOG_IMPORT_INVALID carries `{ total, errors }`: keep it typed so the page can show the rows.
        if (e instanceof AppError && e.details && typeof e.details === "object" && "errors" in e.details) {
          throw new AppError("VALIDATION", e.message, undefined, e.apiCode, { kind: "rows", ...(e.details as object) });
        }
        throw e;
      }
    },
    { operation: "catalog.import.chunk" },
  );
}
