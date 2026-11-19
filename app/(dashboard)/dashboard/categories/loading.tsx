import { LoadingShell, SkeletonHeader, SkeletonTable } from "@/components/shared/skeletons";

/** Categories: header with Add, and the table (name, handle, product count). */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <SkeletonTable
        rows={8}
        columns={[
          { kind: "text", w: "w-40" },
          { kind: "text", w: "w-28", hide: "md" },
          { kind: "text", w: "w-8", align: "right" },
          { kind: "actions" },
        ]}
      />
    </LoadingShell>
  );
}
