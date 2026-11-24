"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Fallback tile colours, keyed by carrier code. Unknown carriers get the neutral tile. */
const TILE: Record<string, string> = {
  shiprocket: "bg-[#5b2fc9] text-white",
  delhivery: "bg-[#e11d2e] text-white",
  bluedart: "bg-[#0b3d91] text-white",
  blue_dart: "bg-[#0b3d91] text-white",
};

/**
 * A carrier's logo. Looks for `public/carriers/<code>.png`; when the file is missing it shows a monogram tile, so a card never
 * has a broken image. Drop the official logo files into `public/carriers/` (named by carrier code, PNG) to replace the tiles.
 */
export function CarrierLogo({ code, name, className }: { code: string; name: string; className?: string }) {
  const [missing, setMissing] = useState(false);
  const tile = "flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border";

  if (missing) {
    return (
      <span aria-hidden className={cn(tile, "w-11 border-transparent text-sm font-semibold", TILE[code] ?? "bg-muted text-foreground", className)}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // A wide wordmark keeps its shape (height fixed, width follows), up to a cap so the card text keeps its room.
    <span className={cn(tile, "max-w-28 bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo with an onError fallback; next/image adds nothing here */}
      <img src={`/carriers/${code}.png`} alt={`${name} logo`} className="h-full w-auto max-w-full object-contain p-1" onError={() => setMissing(true)} />
    </span>
  );
}
