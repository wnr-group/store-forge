import { LoadingShell, SkeletonChart, SkeletonHeader, SkeletonPagination, SkeletonRows, SkeletonSection, SkeletonStats, SkeletonTable, SkeletonToolbar } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Usage & Analytics: filters, five tiles, chart beside a status split, inactive list, then the per-organization table. */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader />
      <SkeletonToolbar search={false} selects={1} dates={2} />
      <SkeletonStats count={5} icon className="sm:grid-cols-2 lg:grid-cols-5" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SkeletonSection description>
          <SkeletonChart height={240} />
        </SkeletonSection>
        <SkeletonSection description>
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </SkeletonSection>
      </div>
      <SkeletonSection description className="mt-6">
        <SkeletonRows rows={4} />
      </SkeletonSection>
      <Skeleton className="mt-8 mb-3 h-4 w-44" />
      <SkeletonToolbar selects={1} sort />
      <SkeletonTable
        rows={8}
        columns={[
          { kind: "text", w: "w-36" },
          { kind: "badge" },
          { kind: "text", w: "w-10", align: "right" },
          { kind: "text", w: "w-10", align: "right" },
          { kind: "text", w: "w-10", align: "right" },
          { kind: "text", w: "w-16", align: "right" },
          { kind: "text", w: "w-24", hide: "lg" },
          { kind: "text", w: "w-24", hide: "xl" },
        ]}
      />
      <SkeletonPagination pageSize />
    </LoadingShell>
  );
}
