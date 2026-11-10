import { LoadingShell, SkeletonHeader, SkeletonSection, SkeletonFields } from "@/components/shared/skeletons";

/** Settings: one card of platform-wide defaults with a save button. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <SkeletonSection description>
        <SkeletonFields count={5} />
      </SkeletonSection>
    </LoadingShell>
  );
}
