export type CategoryNode = { id: string; name: string; parentId: string | null };
export type OrderedCategory<T extends CategoryNode> = T & { level: 1 | 2 | 3; label: string };

const byName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name);

/** Top-level rows alphabetically, each followed by its subcategories. Anything deeper (legacy data) stays visible as level 3. */
export function orderCategories<T extends CategoryNode>(rows: T[]): OrderedCategory<T>[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string, T[]>();
  for (const r of rows) if (r.parentId && ids.has(r.parentId)) kids.set(r.parentId, [...(kids.get(r.parentId) ?? []), r]);
  const out: OrderedCategory<T>[] = [];
  const seen = new Set<string>();
  const walk = (node: T, level: 1 | 2 | 3, label: string) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    out.push({ ...node, level, label });
    for (const c of [...(kids.get(node.id) ?? [])].sort(byName)) walk(c, level === 1 ? 2 : 3, `${label} › ${c.name}`);
  };
  for (const r of rows.filter((x) => !x.parentId || !ids.has(x.parentId)).sort(byName)) walk(r, 1, r.name);
  for (const r of rows) if (!seen.has(r.id)) walk(r, 1, r.name); // unreachable rows (cycles) are still shown
  return out;
}

export type CategoryDeletionImpact = { productCount: number; subcategories: { id: string; name: string }[] };

/** What deleting `id` changes: its own products become uncategorised and its direct subcategories become top-level (DB `SET NULL`). */
export function categoryDeletionImpact<T extends CategoryNode & { productCount?: number }>(rows: T[], id: string): CategoryDeletionImpact {
  return {
    productCount: rows.find((r) => r.id === id)?.productCount ?? 0,
    subcategories: rows.filter((r) => r.parentId === id).sort(byName).map((r) => ({ id: r.id, name: r.name })),
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function describeCategoryDeletion({ productCount, subcategories }: CategoryDeletionImpact): string {
  const products = `${productCount} ${plural(productCount, "product", "products")} will become uncategorised.`;
  const subs =
    subcategories.length === 0
      ? "No subcategories are affected."
      : `${subcategories.length} ${plural(subcategories.length, "subcategory will become a top-level category", "subcategories will become top-level categories")}: ${subcategories.map((s) => s.name).join(", ")}.`;
  return `${products} ${subs} The products themselves are kept.`;
}
