import { LoadingShell, SkeletonHeader, SkeletonPagination, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";

/** Orders: header, search + filters, a table (order, customer, status, payment, placed, total), pagination. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <SkeletonToolbar />
      <SkeletonTable
        rows={10}
        columns={[
          { kind: "text", w: "w-16" },
          { kind: "two-line", w: "w-36", hide: "md" },
          { kind: "text", w: "w-24" },
          { kind: "text", w: "w-24", hide: "sm" },
          { kind: "text", w: "w-28", hide: "lg" },
          { kind: "text", w: "w-20", align: "right" },
        ]}
      />
      <SkeletonPagination />
    </LoadingShell>
  );
}
