"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { formatMoney } from "@/lib/money";

interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  imagePath: string | null;
  available: boolean;
}

const STORAGE_KEY = "sf_recent_products";

function recordRecentProduct(slug: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const updated = [slug, ...existing.filter((s) => s !== slug)].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

function getRecentProducts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function RecommendationsSection({
  node,
  context,
  sectionId,
}: {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}) {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const productResource = context.resource as { slug?: string } | undefined;
  const productSlug = productResource?.slug;
  const storeData = context.store as { slug?: string; currency?: string } | undefined;
  const storeSlug = storeData?.slug ?? "demo";
  const currency = storeData?.currency ?? "INR";
  const source = (node.settings?.source as string) || "related";
  const collectionSlug = (node.settings?.collection_slug as string) || "";
  const title = (node.settings?.title as string) || "Recommended for You";
  const limit = Number(node.settings?.limit) || 4;

  useEffect(() => {
    if (productSlug) {
      recordRecentProduct(productSlug);
    }

    const abortController = new AbortController();
    const viewedSlugs = getRecentProducts().join(",");

    const query = new URLSearchParams({
      source,
      limit: String(limit),
      ...(productSlug ? { productSlug } : {}),
      ...(collectionSlug ? { collectionSlug } : {}),
      ...(viewedSlugs ? { viewedSlugs } : {}),
    });

    fetch(`/api/v1/public/storefronts/${storeSlug}/recommendations?${query.toString()}`, {
      signal: abortController.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        setProducts(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => abortController.abort();
  }, [storeSlug, productSlug, source, collectionSlug, limit]);

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section
      id={sectionId}
      data-sf-section={sectionId}
      className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      aria-label="Product Recommendations"
    >
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
          {title}
        </h2>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="aspect-square rounded-lg bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((prod) => (
              <Link
                key={prod.id}
                href={`/s/${storeSlug}/products/${prod.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card p-2.5 transition-shadow hover:shadow-md"
              >
                <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
                  {prod.imagePath ? (
                    <img
                      src={`/storage/v1/object/public/products/${prod.imagePath}`}
                      alt={prod.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-1 flex-col justify-between">
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {prod.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {formatMoney(prod.priceMinor, currency)}
                    </span>
                    {prod.compareAtPriceMinor && prod.compareAtPriceMinor > prod.priceMinor ? (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatMoney(prod.compareAtPriceMinor, currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
