import { LoadingShell, SkeletonHeader, SkeletonPagination, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";

/** Activity & Audit Logs: search, action + administrator filters, two date pickers, the log table, pagination. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <SkeletonToolbar selects={2} dates={2} />
      <SkeletonTable
        rows={10}
        columns={[
          { kind: "text", w: "w-32" },
          { kind: "badge" },
          { kind: "text", w: "w-36", hide: "md" },
          { kind: "text", w: "w-28", hide: "lg" },
          { kind: "text", w: "w-64" },
        ]}
      />
      <SkeletonPagination pageSize />
    </LoadingShell>
  );
}
