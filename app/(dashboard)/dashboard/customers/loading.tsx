import { LoadingShell, SkeletonHeader, SkeletonPagination, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";

/** Customers: header with Add, search + sort, a table (customer, phone, orders, spent, dates), pagination. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <SkeletonToolbar sort />
      <SkeletonTable
        rows={10}
        columns={[
          { kind: "two-line", w: "w-36" },
          { kind: "text", w: "w-28", hide: "md" },
          { kind: "text", w: "w-8", align: "right" },
          { kind: "text", w: "w-20", align: "right" },
          { kind: "text", w: "w-24", hide: "lg" },
          { kind: "text", w: "w-24", hide: "xl" },
        ]}
      />
      <SkeletonPagination />
    </LoadingShell>
  );
}
