import { LoadingShell, SkeletonHeader, SkeletonRows, SkeletonSection, SkeletonStats } from "@/components/shared/skeletons";

/** Platform overview: four tiles with icons, then the recently created organizations. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <SkeletonStats count={4} icon className="sm:grid-cols-2 lg:grid-cols-4" />
      <SkeletonSection className="mt-6">
        <SkeletonRows rows={5} />
      </SkeletonSection>
    </LoadingShell>
  );
}
