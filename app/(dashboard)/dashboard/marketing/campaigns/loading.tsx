import { LoadingShell, SkeletonHeader } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Discounts: the filters and a table. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <Skeleton className="mb-4 h-9 w-full max-w-md" />
      <Skeleton className="h-72 w-full" />
    </LoadingShell>
  );
}
