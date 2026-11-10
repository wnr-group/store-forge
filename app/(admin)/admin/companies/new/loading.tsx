import { LoadingShell, SkeletonActionBar, SkeletonFields, SkeletonHeader, SkeletonSection } from "@/components/shared/skeletons";

/** Create organization: a centred form in sections (organization, store, owner account). */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <div className="mx-auto max-w-3xl space-y-6">
        <SkeletonSection description>
          <SkeletonFields count={3} />
        </SkeletonSection>
        <SkeletonSection description>
          <SkeletonFields count={2} />
        </SkeletonSection>
        <SkeletonSection description>
          <SkeletonFields count={3} />
        </SkeletonSection>
        <SkeletonActionBar />
      </div>
    </LoadingShell>
  );
}
