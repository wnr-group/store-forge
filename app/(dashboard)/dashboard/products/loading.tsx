import { LoadingShell, SkeletonCardList, SkeletonHeader, SkeletonPagination, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";

/** Products: header with Add, search + three filters + sort, a table (cards on phones), pagination. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <SkeletonToolbar selects={3} sort />
      <SkeletonTable
        className="hidden md:block"
        rows={10}
        columns={[
          { kind: "check" },
          { kind: "media", w: "w-40" },
          { kind: "badge" },
          { kind: "text", w: "w-24" },
          { kind: "text", w: "w-16", align: "right" },
          { kind: "text", w: "w-24", hide: "lg" },
          { kind: "text", w: "w-20", hide: "xl" },
          { kind: "actions" },
        ]}
      />
      <SkeletonCardList count={6} />
      <SkeletonPagination />
    </LoadingShell>
  );
}
