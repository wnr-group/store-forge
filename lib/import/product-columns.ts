// lib/import/product-columns.ts
export const REQUIRED_COLUMNS = ["name", "price"] as const;
export const OPTIONAL_COLUMNS = ["slug", "sku", "short_description", "description", "product_type", "compare_at_price", "cost", "quantity", "track_inventory", "low_stock_threshold", "status", "category", "subcategory"] as const;
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS] as const;
export type ImportColumn = (typeof ALL_COLUMNS)[number];
export const LIMITS = { fileBytes: 1_048_576, rows: 500, payloadBytes: 1_500_000, declaredXlsxBytes: 16 * 1024 * 1024, zipEntries: 100 } as const;
const EXAMPLE: Record<ImportColumn, string> = { name: "Cotton Tee", price: "499.00", slug: "", sku: "TEE-001", short_description: "Soft cotton t-shirt", description: "", product_type: "T-shirt", compare_at_price: "599.00", cost: "250.00", quantity: "25", track_inventory: "true", low_stock_threshold: "5", status: "draft", category: "Apparel", subcategory: "Shirts" };
export function buildTemplateCsv(): string {
  return `${ALL_COLUMNS.join(",")}\r\n${ALL_COLUMNS.map((c) => EXAMPLE[c]).join(",")}\r\n`;
}
