/**
 * Catalog hierarchy models, as the StoreForge API returns them (`/catalog/*`, see store-forge-api `docs/CATALOG_HIERARCHY.md`).
 * Plain types, safe for server and browser code. Dates stay ISO strings: nothing here formats or compares them.
 *
 * Nothing in this file knows how many levels a store has or what they are called: that is the store owner's data.
 */

export type CatalogStatus = "draft" | "active";

export type CatalogLevel = {
  id: string;
  name: string;
  /** 1 = the top level. */
  position: number;
  canHoldProducts: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogHierarchy = {
  id: string;
  name: string;
  status: CatalogStatus;
  /** Top level first. */
  levels: CatalogLevel[];
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogNode = {
  id: string;
  levelId: string;
  levelName: string;
  levelPosition: number;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  status: CatalogStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  depth: number;
  pathIds: string[];
  childCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogTreeNode = CatalogNode & { children: CatalogTreeNode[] };

export type CatalogBreadcrumb = { id: string; name: string; slug: string; path: string; levelName: string };

export type CatalogNodeDetail = CatalogNode & { breadcrumbs: CatalogBreadcrumb[]; path: string; canHoldProducts: boolean };

export type CatalogTree = { nodes: CatalogTreeNode[]; truncated: boolean };

export type CatalogNodeProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  partNumber: string | null;
  status: "draft" | "active";
  priceMinor: number;
  imagePath: string | null;
  position: number;
};

export type CatalogProductPlacement = {
  nodeId: string;
  name: string;
  levelName: string;
  /** Slugs from the top, joined by "/". */
  path: string;
  /** Names of the items from the top level down to this one. */
  names: string[];
  status: CatalogStatus;
  position: number;
};

export type CatalogAssignResult = { assigned: number; alreadyAssigned: number };

export type CatalogPage<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

// ---------------------------------------------------------------------------------------------------------------- import / export

export type CatalogImportSummary = {
  hierarchyCreated: boolean;
  levelsCreated: number;
  levelsUpdated: number;
  nodesCreated: number;
  nodesUpdated: number;
  nodesUnchanged: number;
  assignmentsCreated: number;
  assignmentsExisting: number;
};

export type CatalogImportError = { row: number; column: string; message: string; value: string };

export type CatalogImportResult = {
  dryRun: boolean;
  valid: boolean;
  summary: CatalogImportSummary;
  errors: CatalogImportError[];
  totalErrors: number;
};

/** One row of the levels sheet, as the import request takes it. */
export type CatalogImportLevelRow = { row: number; name?: string; can_hold_products?: string };

/** One row of the items sheet. `level_1` ... `level_20` and the other columns are text, exactly as read from the file. */
export type CatalogImportRow = { row: number; source_errors?: { column: string; message: string }[] } & Record<string, string | number | { column: string; message: string }[] | undefined>;

export type CatalogImportRequest = {
  dryRun?: boolean;
  hierarchyName?: string;
  defaultStatus?: CatalogStatus;
  levels?: CatalogImportLevelRow[];
  rows: CatalogImportRow[];
};

export type CatalogExportPage = {
  hierarchy: { id: string; name: string; status: CatalogStatus };
  levels: { name: string; can_hold_products: string }[];
  columns: string[];
  rows: Record<string, string>[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ProductExportPage = { columns: string[]; rows: Record<string, string>[]; page: number; limit: number; total: number; totalPages: number };

// ---------------------------------------------------------------------------------------------------------------- limits (the API's)

/** The backend's technical limits, mirrored for the screens. The API enforces them again. */
export const CATALOG_LIMITS = {
  maxLevels: 20,
  importRowsPerRequest: 2000,
  /** Largest `rows` payload sent in one request (the API accepts 2 MB; server actions here accept 2 MB too). */
  importBytesPerRequest: 1_200_000,
  productsPerRequest: 500,
  nodesPerBulk: 100,
  pairsPerBulk: 20_000,
  exportPageSize: 1000,
} as const;
