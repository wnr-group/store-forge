import type { CatalogLevel, CatalogNode, CatalogTreeNode } from "./types";

/**
 * Pure helpers for the catalog tree on the dashboard. They only read the shapes the API returns; they know nothing about how many
 * levels a store has or what they are called.
 */

/** Every item of the tree, parents before their children (depth first, in display order). */
export function flattenTree(nodes: CatalogTreeNode[]): CatalogTreeNode[] {
  const out: CatalogTreeNode[] = [];
  const walk = (list: CatalogTreeNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function indexTree(nodes: CatalogTreeNode[]): Map<string, CatalogTreeNode> {
  return new Map(flattenTree(nodes).map((n) => [n.id, n]));
}

/** The names of the items from the top level down to `node`, joined for display ("Mahindra › Centuro"). Falls back to the item's own name. */
export function pathLabel(node: Pick<CatalogNode, "id" | "name" | "pathIds">, byId: Map<string, { name: string }>, separator = " › "): string {
  const names = node.pathIds.map((id) => byId.get(id)?.name).filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(separator) : node.name;
}

/** Items whose level may carry products, with the path to show in a picker. */
export function productHolders(nodes: CatalogTreeNode[], levels: CatalogLevel[]): { id: string; label: string; levelName: string }[] {
  const holds = new Set(levels.filter((l) => l.canHoldProducts).map((l) => l.id));
  const byId = indexTree(nodes);
  return flattenTree(nodes)
    .filter((n) => holds.has(n.levelId))
    .map((n) => ({ id: n.id, label: pathLabel(n, byId), levelName: n.levelName }));
}

/** The level an item's children would be on, or null when it is on the last level. */
export function childLevel(levels: CatalogLevel[], node: Pick<CatalogNode, "levelPosition">): CatalogLevel | null {
  return levels.find((l) => l.position === node.levelPosition + 1) ?? null;
}

/** The level an item's parent is on (null for the top level). */
export function parentLevel(levels: CatalogLevel[], node: Pick<CatalogNode, "levelPosition">): CatalogLevel | null {
  return node.levelPosition <= 1 ? null : (levels.find((l) => l.position === node.levelPosition - 1) ?? null);
}

/** `ids` with `id` moved one place up (-1) or down (1). Returns the same order when it cannot move. */
export function shiftId(ids: string[], id: string, direction: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** The siblings of an item, in order, from the tree. `parentId` null = the top level. */
export function childrenOf(nodes: CatalogTreeNode[], parentId: string | null): CatalogTreeNode[] {
  if (parentId === null) return nodes;
  return indexTree(nodes).get(parentId)?.children ?? [];
}

/** The reasons the API gave for refusing a level order (`details.problems`), or an empty list for any other kind of error detail. */
export function levelOrderProblems(details: unknown): string[] {
  if (!details || typeof details !== "object" || !("problems" in details)) return [];
  const problems = (details as { problems: unknown }).problems;
  return Array.isArray(problems) ? problems.filter((p): p is string => typeof p === "string") : [];
}
