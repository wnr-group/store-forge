import { Skeleton } from "@/components/ui/skeleton";

/** Instant route fallback: same header + content rhythm as real pages, so nothing jumps when data arrives. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="hidden h-8 w-28 sm:block" />
        <Skeleton className="hidden h-8 w-28 sm:block" />
      </div>
      <div className="divide-y rounded-lg border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-14 items-center gap-3 px-4">
            <Skeleton className="size-8 shrink-0" />
            <Skeleton className="h-4 w-40 max-w-[50%]" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
