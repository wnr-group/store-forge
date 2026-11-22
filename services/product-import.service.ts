// services/product-import.service.ts
import "server-only";
import { importProductsApi, type ProductImportRowApi } from "@/lib/api/endpoints/product-api";
import { AppError } from "@/lib/errors";
import { importDetailsSchema } from "@/lib/import/import-result";
import { requireActiveTenant } from "@/lib/tenant/context";

/** Thin API client: permission first, then one call. All validation and the transaction live in the API. */
export async function importProducts(rows: ProductImportRowApi[]): Promise<{ count: number }> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  try {
    return await importProductsApi(tenant.id, rows);
  } catch (e) {
    if (e instanceof AppError && e.details && typeof e.details === "object") {
      const parsed = importDetailsSchema.safeParse({ kind: "rows", ...(e.details as object) });
      if (parsed.success) throw new AppError("VALIDATION", e.message, undefined, undefined, parsed.data);
      throw new AppError("UNKNOWN", "Something went wrong. Please try again.");
    }
    throw e;
  }
}
