import { LoadingShell, SkeletonHeader } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Catalog hierarchy: the levels card, then the tree of items. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={3} />
      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}
