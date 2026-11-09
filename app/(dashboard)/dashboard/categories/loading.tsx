import { LoadingShell, SkeletonHeader, SkeletonTable } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Categories: header, an Add button above the table, and the table (name, parent, handle, product count). */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <div className="mb-4 flex justify-end">
        <Skeleton className="h-8 w-32" />
      </div>
      <SkeletonTable
        rows={8}
        columns={[
          { kind: "text", w: "w-40" },
          { kind: "text", w: "w-24", hide: "sm" },
          { kind: "text", w: "w-28", hide: "md" },
          { kind: "text", w: "w-8", align: "right" },
          { kind: "actions" },
        ]}
      />
    </LoadingShell>
  );
}
