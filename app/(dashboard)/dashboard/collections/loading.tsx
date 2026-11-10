import { LoadingShell, SkeletonHeader } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Collections: a grid of cards, each with a 16:9 image, a name and status, and a product count. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border bg-card">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-1.5 p-3">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
