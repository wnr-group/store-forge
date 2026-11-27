import type { ComponentNode } from "@/lib/templates/document";
import { CatalogView } from "@/components/storefront/catalog/catalog-view";
import type { RenderContext } from "../types";

/**
 * The catalog hierarchy page: the same section for every template. It draws `context.catalog` (set by the catalog route from the
 * published hierarchy of THIS store) with the template's own skin and product cards, and fetches nothing. Without catalog data, such as
 * in an editor preview of some other page, it draws nothing.
 */
export function CatalogSection({ context, sectionId }: { node: ComponentNode; context: RenderContext; sectionId?: string }) {
  const data = context.catalog;
  if (!data) return null;
  const preview = context.mode === "preview" || context.mode === "editor";
  return <CatalogView data={data} theme={context.theme} currency={(context.store.currency as string | undefined) ?? "INR"} storeName={context.store.name} sfProps={preview && sectionId ? { "data-sf-section": sectionId } : undefined} />;
}
