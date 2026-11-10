import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, SearchX, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, LEGACY_AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/admin/audit";
import { ADMIN_PAGE_SIZES, auditListQuerySchema } from "@/lib/validations/admin-list";
import { listAuditAdmins, listAuditLogs, type AuditRow } from "@/services/admin-audit.service";

export const metadata: Metadata = { title: "Activity & Audit Logs" };

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const label = (action: string) => AUDIT_ACTION_LABELS[action as AuditAction] ?? LEGACY_AUDIT_ACTION_LABELS[action] ?? action;
const tone = (action: string) =>
  action.endsWith(".removed") || action.endsWith(".suspended") || action.endsWith(".disabled")
    ? "warning"
    : action.endsWith(".created") || action.endsWith(".added")
      ? "active"
      : "info";

/** Before and after facts of a change, when the entry recorded any. Credentials are never stored, so nothing sensitive can show here. */
function Details({ row }: { row: AuditRow }) {
  if (!row.previousData && !row.newData) return null;
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Details</summary>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {row.previousData ? (
          <div>
            <p className="font-medium text-foreground">Before</p>
            <pre className="overflow-x-auto rounded bg-muted p-2 whitespace-pre-wrap">{JSON.stringify(row.previousData, null, 2)}</pre>
          </div>
        ) : null}
        {row.newData ? (
          <div>
            <p className="font-medium text-foreground">After</p>
            <pre className="overflow-x-auto rounded bg-muted p-2 whitespace-pre-wrap">{JSON.stringify(row.newData, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = auditListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [{ rows, total, page, pageSize }, admins] = await Promise.all([listAuditLogs(query), listAuditAdmins()]);
  const filtered = query.action !== "all" || query.admin !== "all" || Boolean(query.org || query.q || query.from || query.to);

  return (
    <>
      <PageHeader title="Activity & Audit Logs" description="What Platform Admins did, newest first. Entries cannot be edited or removed." />
      <ListFilters
        searchPlaceholder="Search by organization name"
        filters={[
          { key: "action", label: "Action", options: [{ value: "all", label: "All actions" }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] }))] },
          { key: "admin", label: "Administrator", options: [{ value: "all", label: "All administrators" }, ...admins.map((a) => ({ value: a.id, label: a.email }))] },
        ]}
        dateFilters={[
          { key: "from", label: "From" },
          { key: "to", label: "To" },
        ]}
      />
      {query.org ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          Showing one organization only.
          <Link href={ROUTES.adminActivity} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
            <X className="size-3.5" aria-hidden /> Show all
          </Link>
        </p>
      ) : null}
      {total === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="No activity matches" description="Try different filters or a wider date range." />
        ) : (
          <EmptyState icon={ScrollText} title="No activity yet" description="Actions such as creating or suspending an organization will appear here." />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Administrator</TableHead>
                  <TableHead className="hidden lg:table-cell">Organization</TableHead>
                  <TableHead>What happened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="text-sm text-muted-foreground">{when.format(r.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={tone(r.action)}>{label(r.action)}</StatusBadge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{r.adminEmail}</TableCell>
                    <TableCell className="hidden lg:table-cell">{r.organizationName ?? "—"}</TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      <span className="block">{r.description}</span>
                      <Details row={r} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath={ROUTES.adminActivity}
            params={{ action: query.action, admin: query.admin, org: query.org, q: query.q, from: query.from, to: query.to, pageSize: String(pageSize) }}
            pageSizeOptions={ADMIN_PAGE_SIZES}
          />
        </>
      )}
    </>
  );
}
