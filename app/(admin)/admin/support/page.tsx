import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ROUTES } from "@/config/app";
import { ADMIN_PAGE_SIZES, supportListQuerySchema } from "@/lib/validations/admin-list";
import { listSupportNotes } from "@/services/platform-support.service";

export const metadata: Metadata = { title: "Support" };

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = supportListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { notes, total, page, pageSize } = await listSupportNotes({ q: query.q, page: query.page, pageSize: query.pageSize });

  return (
    <>
      <PageHeader
        title="Support"
        description="Internal notes about organizations, newest first. Only platform admins can see them. Add a note from an organization's page."
      />
      <ListFilters searchPlaceholder="Search by organization or note" />
      {total === 0 ? (
        query.q ? (
          <EmptyState icon={SearchX} title="No notes match" description="Try a different search." />
        ) : (
          <EmptyState icon={LifeBuoy} title="No support notes yet" description="Open an organization and add a note to keep context for the team." />
        )
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card px-4">
            {notes.map((n) => (
              <li key={n.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <Link href={`${ROUTES.adminCompanies}/${n.tenantId}`} className="text-sm font-medium text-foreground hover:underline">
                    {n.tenantName}
                  </Link>
                  <span>
                    {n.authorEmail} · {when.format(n.createdAt)}
                    {n.edited ? " · edited" : ""}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={pageSize} total={total} basePath={ROUTES.adminSupport} params={{ q: query.q, pageSize: String(pageSize) }} pageSizeOptions={ADMIN_PAGE_SIZES} />
        </>
      )}
    </>
  );
}
