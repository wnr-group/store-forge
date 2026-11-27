import { collectPages, fileResponse } from "@/lib/import/export-file";
import { exportFailure, exportFormat } from "@/lib/import/export-route";
import { LEVELS_SHEET_NAME } from "@/lib/import/catalog-columns";
import { CATALOG_LIMITS } from "@/lib/catalog/types";
import { exportCatalogPage } from "@/services/catalog.service";

/**
 * Downloads the catalog in the import format. `?format=xlsx` is one workbook (items on the first sheet, levels on a sheet named "Levels"):
 * importing it again changes nothing. `?format=csv` is the items; `?part=levels` is the levels as their own CSV. The session and the
 * permission are checked by the service, and the API only returns this organization's catalog.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = exportFormat(url.searchParams.get("format"));
  try {
    const { first, rows } = await collectPages((page) => exportCatalogPage(page, CATALOG_LIMITS.exportPageSize));
    const items = { columns: first.columns, rows };
    const levels = { columns: ["name", "can_hold_products"], rows: first.levels.map((l) => ({ name: l.name, can_hold_products: l.can_hold_products })) };
    if (format === "xlsx") return fileResponse("xlsx", `${first.hierarchy.name}-catalog`, [{ name: "Catalog", table: items }, { name: LEVELS_SHEET_NAME, table: levels }]);
    if (url.searchParams.get("part") === "levels") return fileResponse("csv", `${first.hierarchy.name}-catalog-levels`, [{ name: LEVELS_SHEET_NAME, table: levels }]);
    return fileResponse("csv", `${first.hierarchy.name}-catalog`, [{ name: "Catalog", table: items }]);
  } catch (error) {
    return exportFailure(error);
  }
}

