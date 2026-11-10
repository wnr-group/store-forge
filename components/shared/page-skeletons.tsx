import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingShell,
  SkeletonActionBar,
  SkeletonChart,
  SkeletonEditorLayout,
  SkeletonField,
  SkeletonFields,
  SkeletonHeader,
  SkeletonRows,
  SkeletonSection,
  SkeletonStats,
} from "./skeletons";

/** Sales overview and analytics: metric tiles, the sales chart, best sellers / recent orders side by side, low stock. */
export function SalesOverviewSkeleton({ detailed = false }: { detailed?: boolean }) {
  return (
    <LoadingShell>
      <SkeletonHeader actions={detailed ? 0 : 2} />
      {detailed ? <Skeleton className="-mt-2 mb-4 ml-auto h-9 w-52" /> : null}
      <div className="space-y-4">
        <SkeletonStats count={4} />
        <SkeletonSection description>
          <SkeletonChart height={detailed ? 300 : 260} />
        </SkeletonSection>
        {detailed ? (
          <SkeletonSection description>
            <SkeletonChart height={220} />
          </SkeletonSection>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonSection description>
            <SkeletonRows rows={5} />
          </SkeletonSection>
          <SkeletonSection>
            <SkeletonRows rows={5} badge />
          </SkeletonSection>
        </div>
        <SkeletonSection description>
          <SkeletonRows rows={4} />
        </SkeletonSection>
      </div>
    </LoadingShell>
  );
}

/** The product form: a long column of sections on the left, status and organization on the right, a sticky save bar. */
export function ProductEditorSkeleton({ editing = false }: { editing?: boolean }) {
  return (
    <LoadingShell>
      <SkeletonHeader actions={editing ? 2 : 0} description={editing} />
      <SkeletonEditorLayout
        main={
          <>
            <SkeletonSection>
              <SkeletonField label="w-28" />
              <SkeletonFields count={2} />
            </SkeletonSection>
            <SkeletonSection>
              <Skeleton className="h-32 w-full" />
            </SkeletonSection>
            <SkeletonSection description>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square w-full" />
                ))}
              </div>
            </SkeletonSection>
            <SkeletonSection description>
              <SkeletonFields count={3} cols={3} />
            </SkeletonSection>
            <SkeletonSection description>
              <SkeletonFields count={3} cols={3} />
              <SkeletonFields count={3} cols={3} />
            </SkeletonSection>
            <SkeletonSection description action>
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </SkeletonSection>
          </>
        }
        side={
          <>
            <SkeletonSection>
              <SkeletonField label="w-16" />
            </SkeletonSection>
            <SkeletonSection>
              <SkeletonField label="w-20" />
              <SkeletonField label="w-24" />
            </SkeletonSection>
          </>
        }
      />
      <SkeletonActionBar />
    </LoadingShell>
  );
}

/** The collection form: details and a product picker on the left, status and image on the right. */
export function CollectionEditorSkeleton({ editing = false }: { editing?: boolean }) {
  return (
    <LoadingShell>
      <SkeletonHeader actions={editing ? 1 : 0} description={false} />
      <SkeletonEditorLayout
        main={
          <>
            <SkeletonSection>
              <SkeletonField label="w-20" />
              <SkeletonField label="w-28" />
              <Skeleton className="h-20 w-full" />
            </SkeletonSection>
            <SkeletonSection description>
              <Skeleton className="h-9 w-full" />
              <SkeletonRows rows={6} />
            </SkeletonSection>
          </>
        }
        side={
          <>
            <SkeletonSection>
              <SkeletonField label="w-16" />
            </SkeletonSection>
            <SkeletonSection>
              <Skeleton className="aspect-[16/9] w-full" />
            </SkeletonSection>
          </>
        }
      />
      <SkeletonActionBar />
    </LoadingShell>
  );
}
