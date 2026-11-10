import { LoadingShell, SkeletonHeader, SkeletonPagination, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";

/** Inventory: search + stock filter, a table (product, SKU, status, available, adjust), pagination. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <SkeletonToolbar selects={1} />
      <SkeletonTable
        rows={10}
        columns={[
          { kind: "media", w: "w-40" },
          { kind: "text", w: "w-20", hide: "sm" },
          { kind: "badge" },
          { kind: "text", w: "w-10", align: "right", hide: "sm" },
          { kind: "text", w: "w-16", align: "right" },
        ]}
      />
      <SkeletonPagination />
    </LoadingShell>
  );
}
