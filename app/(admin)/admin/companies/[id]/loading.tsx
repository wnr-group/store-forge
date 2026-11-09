import { LoadingShell, SkeletonFields, SkeletonHeader, SkeletonRows, SkeletonSection } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

function Details({ count, cols }: { count: number; cols: string }) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/** One organization: status controls, details + edit form, store, usage figures and the team. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={2} />
      <div className="space-y-6">
        <SkeletonSection description>
          <Skeleton className="h-8 w-48" />
        </SkeletonSection>
        <SkeletonSection description>
          <Details count={3} cols="sm:grid-cols-3" />
          <SkeletonFields count={3} />
        </SkeletonSection>
        <SkeletonSection description>
          <Skeleton className="h-16 w-full" />
        </SkeletonSection>
        <SkeletonSection description>
          <Details count={6} cols="sm:grid-cols-3 lg:grid-cols-6" />
        </SkeletonSection>
        <SkeletonSection description action>
          <SkeletonRows rows={4} badge />
        </SkeletonSection>
      </div>
    </LoadingShell>
  );
}
