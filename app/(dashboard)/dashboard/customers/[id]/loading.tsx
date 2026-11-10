import { LoadingShell, SkeletonHeader, SkeletonRows, SkeletonSection } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** One customer: contact and summary on the left, the order history on the right. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={2} />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <SkeletonSection>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </SkeletonSection>
          <SkeletonSection>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </SkeletonSection>
        </div>
        <SkeletonSection>
          <SkeletonRows rows={5} badge />
        </SkeletonSection>
      </div>
    </LoadingShell>
  );
}
