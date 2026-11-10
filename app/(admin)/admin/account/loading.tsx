import { LoadingShell, SkeletonFields, SkeletonHeader, SkeletonSection } from "@/components/shared/skeletons";

/** Account: a centred change-password card. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <div className="mx-auto max-w-3xl">
        <SkeletonSection description>
          <SkeletonFields count={3} cols={1} />
        </SkeletonSection>
      </div>
    </LoadingShell>
  );
}
