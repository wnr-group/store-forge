import { LoadingShell, SkeletonHeader, SkeletonSettingsSection } from "@/components/shared/skeletons";

/** Integrations: one card per connection. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <div className="max-w-3xl divide-y">
        <SkeletonSettingsSection fields={2} cols={2} />
      </div>
    </LoadingShell>
  );
}
