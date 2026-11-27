"use client";

import Link from "next/link";

/** The catalog could not be loaded (the store's data service did not answer). Shoppers can retry or go back to the store. */
export default function CatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <h1 className="text-2xl font-semibold tracking-tight">We could not load the catalog</h1>
      <p className="text-sm text-muted-foreground">Something went wrong on our side. Please try again in a moment.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Back to the store
        </Link>
      </div>
    </div>
  );
}
