import { LoadingShell, SkeletonHeader } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Payments: header and one settings panel. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={0} />
      <Skeleton className="h-72 max-w-5xl rounded-lg" />
    </LoadingShell>
  );
}
