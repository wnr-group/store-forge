// app/(dashboard)/dashboard/products/import/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { AppError } from "@/lib/errors";
import { parseProductFile } from "@/lib/import/parse-product-file";
import { invalidateStorefront } from "@/lib/storefront/cache";
import { requireActiveTenant } from "@/lib/tenant/context";
import { importProducts } from "@/services/product-import.service";

export async function importProductsAction(formData: FormData) {
  return run(
    async () => {
      await requireActiveTenant("catalog:manage"); // before reading the file
      const file = formData.get("file");
      if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to import.");
      const parsed = await parseProductFile(file);
      if (!parsed.ok) throw new AppError("VALIDATION", "No products were imported.", undefined, undefined, { kind: "file", errors: parsed.errors });
      const result = await importProducts(parsed.rows);
      revalidatePath(ROUTES.products);
      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.inventory);
      await invalidateStorefront();
      return result;
    },
    { operation: "products.import" },
  );
}
