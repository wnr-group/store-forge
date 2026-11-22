"use client";

import { useEffect, useState } from "react";
import { MessageSquare, ShieldCheck, Star } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { cn } from "@/lib/utils";

interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  reviewedAt: string;
  source: string;
  originLabel: string | null;
  verifiedPurchase: boolean;
}

interface ReviewsResponse {
  disclosure: string;
  language: string;
  total: number;
  averageRating: number;
  reviews: PublicReview[];
}

export function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-5" : size === "md" ? "size-4" : "size-3.5";
  return (
    <div className="flex items-center gap-0.5 text-amber-500" aria-label={`Rating: ${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClass,
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-500"
              : "fill-muted text-muted-foreground/30",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function ReviewsSection({
  node,
  context,
  sectionId,
}: {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const productResource = context.resource as { slug?: string } | undefined;
  const productSlug = productResource?.slug;
  const storeData = context.store as { slug?: string } | undefined;
  const storeSlug = storeData?.slug ?? "demo";

  useEffect(() => {
    if (!productSlug) {
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    fetch(`/api/v1/public/storefronts/${storeSlug}/products/${productSlug}/reviews`, {
      signal: abortController.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setData(json.data);
        else if (json) setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => abortController.abort();
  }, [storeSlug, productSlug]);

  const title = (node.settings?.title as string) || "Customer Reviews";
  const disclosure = data?.disclosure || "Feedback collected by the store.";

  return (
    <section
      id={sectionId}
      data-sf-section={sectionId}
      className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      aria-label="Customer Reviews"
    >
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>

        {/* Mandatory Unhideable Disclosure (AC-REV-03) */}
        <div
          data-testid="review-disclosure"
          className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <ShieldCheck className="size-4 text-primary shrink-0" aria-hidden />
          <span>{disclosure}</span>
        </div>

        {data && data.total > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {data.averageRating.toFixed(1)}
              </span>
              <StarRating rating={data.averageRating} size="md" />
            </div>
            <span className="text-sm text-muted-foreground">
              Based on {data.total} {data.total === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading customer feedback…
          </div>
        ) : !data || data.reviews.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto size-8 text-muted-foreground/50 mb-2" aria-hidden />
            <p className="font-medium text-foreground">No reviews yet</p>
            <p className="mt-1 text-xs">Be the first to share your thoughts on this product.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.reviews.map((rev) => (
              <div
                key={rev.id}
                className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <StarRating rating={rev.rating} size="sm" />
                    {rev.originLabel ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {rev.originLabel}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground text-base leading-snug">
                    {rev.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {rev.body}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex items-center justify-between">
                  <span className="font-medium text-foreground">{rev.authorName}</span>
                  <time dateTime={rev.reviewedAt}>
                    {new Date(rev.reviewedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
