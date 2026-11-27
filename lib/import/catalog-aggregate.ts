import type { CatalogImportError, CatalogImportResult, CatalogImportSummary } from "@/lib/catalog/types";

/** The outcome of a whole file that was sent to the API in several requests. */
export type ImportAggregate = { valid: boolean; summary: CatalogImportSummary; errors: CatalogImportError[]; totalErrors: number; requests: number };

const MAX_ERRORS = 500;

/**
 * Joins the answers of the requests of one file. Every request repeats the levels, so what concerns the catalog and its levels is taken from
 * the first answer (counting it per request would multiply it); items and placements are added up. Problems are listed once each even when
 * several requests report the same one (a level problem is reported by every request), in file order.
 */
export function aggregateImport(parts: CatalogImportResult[]): ImportAggregate {
  const first = parts[0]?.summary;
  const summary: CatalogImportSummary = {
    hierarchyCreated: first?.hierarchyCreated ?? false,
    levelsCreated: first?.levelsCreated ?? 0,
    levelsUpdated: first?.levelsUpdated ?? 0,
    nodesCreated: 0,
    nodesUpdated: 0,
    nodesUnchanged: 0,
    assignmentsCreated: 0,
    assignmentsExisting: 0,
  };
  const seen = new Set<string>();
  const errors: CatalogImportError[] = [];
  let totalErrors = 0;
  for (const part of parts) {
    summary.nodesCreated += part.summary.nodesCreated;
    summary.nodesUpdated += part.summary.nodesUpdated;
    summary.nodesUnchanged += part.summary.nodesUnchanged;
    summary.assignmentsCreated += part.summary.assignmentsCreated;
    summary.assignmentsExisting += part.summary.assignmentsExisting;
    let repeated = 0;
    for (const e of part.errors) {
      const key = `${e.row}|${e.column}|${e.message}`;
      if (seen.has(key)) {
        repeated++;
        continue;
      }
      seen.add(key);
      if (errors.length < MAX_ERRORS) errors.push(e);
    }
    totalErrors += Math.max(0, part.totalErrors - repeated);
  }
  errors.sort((a, b) => a.row - b.row);
  return { valid: parts.every((p) => p.valid), summary, errors, totalErrors, requests: parts.length };
}
