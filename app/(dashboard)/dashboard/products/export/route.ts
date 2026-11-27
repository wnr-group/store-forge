import { collectPages, fileResponse } from "@/lib/import/export-file";
import { exportFailure, exportFormat } from "@/lib/import/export-route";
import { exportProductsPage } from "@/services/catalog.service";

/**
 * Downloads the store's products in the product import format (plus `id` and `has_variants`, which the import ignores), with the part
 * number next to the SKU. Products with variants are included and marked: the import only creates simple products.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = exportFormat(url.searchParams.get("format"));
  const status = url.searchParams.get("status");
  try {
    const { first, rows } = await collectPages((page) => exportProductsPage(page, 1000, status === "draft" || status === "active" ? status : "all"));
    return fileResponse(format, "products", [{ name: "Products", table: { columns: first.columns, rows } }]);
  } catch (error) {
    return exportFailure(error);
  }
}

