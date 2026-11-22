"use client";

import { useCallback, useMemo, useState } from "react";
import { getPreviewCollectionProductsAction, getPreviewProductAction } from "@/app/(dashboard)/dashboard/templates/actions";
import type { PreviewData } from "@/lib/themes/preview-data";

export type TargetKind = "product" | "collection" | "content";
type Product = PreviewData["store"]["products"][number];

/**
 * Which product, collection or content page the editor is showing while a product, collection or content page is open, so
 * that clicking a link to another product opens that product, as on the storefront. The store's own data is fetched for the
 * chosen one (pictures, options, variants; the collection's products); until it arrives the summary already at hand is shown.
 */
export function usePreviewTarget(preview: PreviewData) {
  const [chosen, setChosen] = useState<Record<TargetKind, string | null>>({ product: null, collection: null, content: null });
  const [products, setProducts] = useState<Record<string, Record<string, unknown> | null>>({});
  const [collections, setCollections] = useState<Record<string, Product[] | null>>({});
  const live = preview.mode === "store";

  const choose = useCallback(
    (kind: TargetKind, slug: string) => {
      setChosen((c) => ({ ...c, [kind]: slug }));
      if (!live) return;
      if (kind === "product" && !(slug in products)) {
        void getPreviewProductAction(slug).then((r) => setProducts((p) => ({ ...p, [slug]: r.ok ? (r.data ?? null) : null })));
      }
      if (kind === "collection" && !(slug in collections) && !preview.collectionProducts?.[slug]) {
        void getPreviewCollectionProductsAction(slug).then((r) => setCollections((p) => ({ ...p, [slug]: r.ok ? (r.data ?? null) : null })));
      }
    },
    [live, products, collections, preview.collectionProducts],
  );

  const productSlug = chosen.product ?? (preview.productPage?.slug as string | undefined) ?? preview.store.products[0]?.slug ?? null;
  const collectionSlug = chosen.collection ?? preview.collections[0]?.slug ?? null;
  const contentPages = useMemo(() => preview.contentPages ?? [], [preview.contentPages]);
  const contentPage = contentPages.find((p) => p.slug === chosen.content) ?? contentPages[0] ?? null;

  /** The product a product page shows: the full page data when we have it, else the listing summary. */
  const productResource = useMemo((): Record<string, unknown> | undefined => {
    if (!productSlug) return undefined;
    const full = products[productSlug] ?? (preview.productPage?.slug === productSlug ? preview.productPage : null);
    if (full) return full;
    const p = preview.store.products.find((x) => x.slug === productSlug);
    return p ? { ...p, images: p.image_path ? [p.image_path] : [], options: [], variants: [] } : undefined;
  }, [productSlug, products, preview.productPage, preview.store.products]);

  const collectionResource = useMemo((): Record<string, unknown> | undefined => {
    const c = preview.collections.find((x) => x.slug === collectionSlug);
    return c ? { ...c, products: preview.collectionProducts?.[c.slug] ?? collections[c.slug] ?? [] } : undefined;
  }, [collectionSlug, collections, preview.collections, preview.collectionProducts]);

  return { choose, productSlug, collectionSlug, contentPage, contentPages, productResource, collectionResource };
}
