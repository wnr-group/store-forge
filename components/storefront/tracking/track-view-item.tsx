"use client";

import { useEffect, useRef } from "react";
import { useTracker } from "./tracking-provider";

/** Reports that a product page was viewed. Renders nothing. Tries again until the tag is ready, and reports each product once. */
export function TrackViewItem({ slug, name, priceMinor, currency }: { slug: string; name: string; priceMinor: number; currency: string }) {
  const { track } = useTracker();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === slug) return;
    if (track({ type: "view_item", currency, items: [{ id: slug, name, priceMinor, quantity: 1 }] })) sent.current = slug;
  }, [track, slug, name, priceMinor, currency]);
  return null;
}
