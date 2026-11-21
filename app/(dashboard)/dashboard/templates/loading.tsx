import { LoadingShell, SkeletonHeader } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Themes: the current-theme strip and a grid of theme cards, each with a tall preview, a name and two buttons. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <Skeleton className="mb-5 h-28 w-full rounded-lg" />
      <div className="mb-5 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-8 w-32" />
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border bg-card">
            <Skeleton className="h-[300px] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
