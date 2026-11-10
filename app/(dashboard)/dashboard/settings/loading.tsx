import { LoadingShell, SkeletonHeader, SkeletonSettingsSection } from "@/components/shared/skeletons";

/** Settings: the store profile, contact and regional blocks, then your profile and password. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <div className="max-w-5xl divide-y">
        <SkeletonSettingsSection fields={4} cols={2} />
        <SkeletonSettingsSection fields={2} cols={2} />
        <SkeletonSettingsSection fields={2} cols={2} />
        <SkeletonSettingsSection fields={2} cols={1} />
        <SkeletonSettingsSection fields={3} cols={1} />
      </div>
    </LoadingShell>
  );
}
