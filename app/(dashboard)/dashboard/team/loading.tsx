import { LoadingShell, SkeletonHeader, SkeletonTable } from "@/components/shared/skeletons";

/** Team members: header with Add, and the team table (name, email, role, access, status). */
export default function Loading() {
  return (
    <LoadingShell>
      <SkeletonHeader actions={1} />
      <SkeletonTable
        rows={6}
        columns={[
          { kind: "text", w: "w-32" },
          { kind: "text", w: "w-40", hide: "sm" },
          { kind: "text", w: "w-20", hide: "sm" },
          { kind: "text", w: "w-48", hide: "md" },
          { kind: "badge" },
          { kind: "actions" },
        ]}
      />
    </LoadingShell>
  );
}
