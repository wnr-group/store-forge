import { LoadingShell, SkeletonHeader, SkeletonPagination, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";

/** Organizations: header with Create, search + status + sort, the table, pagination with page size. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <SkeletonToolbar selects={1} sort />
      <SkeletonTable
        rows={10}
        columns={[
          { kind: "text", w: "w-40" },
          { kind: "two-line", w: "w-28", hide: "md" },
          { kind: "text", w: "w-36", hide: "lg" },
          { kind: "text", w: "w-8", align: "right" },
          { kind: "badge" },
          { kind: "text", w: "w-24", hide: "xl" },
        ]}
      />
      <SkeletonPagination pageSize />
    </LoadingShell>
  );
}
