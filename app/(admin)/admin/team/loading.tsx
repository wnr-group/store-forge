import { LoadingShell, SkeletonHeader, SkeletonTable } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Platform Team: an Add button above the table of platform admins (name, role, added by, actions). */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <div className="mb-4 flex justify-end">
        <Skeleton className="h-8 w-36" />
      </div>
      <SkeletonTable
        rows={4}
        columns={[
          { kind: "two-line", w: "w-36" },
          { kind: "badge" },
          { kind: "text", w: "w-32", hide: "md" },
          { kind: "text", w: "w-24", hide: "lg" },
          { kind: "actions" },
        ]}
      />
    </LoadingShell>
  );
}
