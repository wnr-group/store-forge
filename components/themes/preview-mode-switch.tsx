"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { ROUTES } from "@/config/app";
import type { PreviewMode } from "@/lib/themes/preview-data";
import { cn } from "@/lib/utils";

const MODES: { id: PreviewMode; label: string }[] = [
  { id: "store", label: "Your store" },
  { id: "demo", label: "Demo" },
];

/** Chooses what a theme preview is filled with: the merchant's real products, or isolated demo content. */
export function PreviewModeSwitch({ mode, onChange, className }: { mode: PreviewMode; onChange: (mode: PreviewMode) => void; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-lg border p-0.5", className)} role="group" aria-label="Preview with">
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => onChange(id)}
          className={cn("rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", mode === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** One line under a preview that says whose products are on screen, and how to get real ones in when there are none. */
export function PreviewModeNote({ mode, storeHasProducts, className }: { mode: PreviewMode; storeHasProducts: boolean; className?: string }) {
  if (mode === "demo") {
    return <p className={cn("text-xs text-muted-foreground", className)}>Demo preview: sample products for exploring this theme. They are not saved to your store.</p>;
  }
  if (!storeHasProducts) {
    return (
      <p className={cn("flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground", className)}>
        <Package className="size-3.5" aria-hidden />
        Your store has no active products yet.
        <Link href={`${ROUTES.products}/new`} className="font-medium text-foreground underline underline-offset-2">Add a product</Link>
        or switch to Demo.
      </p>
    );
  }
  return <p className={cn("text-xs text-muted-foreground", className)}>Showing your store&apos;s active products and collections.</p>;
}
