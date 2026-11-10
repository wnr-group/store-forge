import type { Metadata } from "next";
import Link from "next/link";
import { Building2, PlusCircle, SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { ADMIN_PAGE_SIZES, orgListQuerySchema } from "@/lib/validations/admin-list";
import { listCompaniesPage, type CompanySummary } from "@/services/platform.service";

export const metadata: Metadata = { title: "Organizations" };

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function OrganizationsTable({ companies }: { companies: CompanySummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Organization</TableHead>
            <TableHead className="hidden md:table-cell">Owner</TableHead>
            <TableHead className="hidden lg:table-cell">Store</TableHead>
            <TableHead className="text-right">Users</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden xl:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`${ROUTES.adminCompanies}/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="block">{c.ownerName ?? "—"}</span>
                <span className="block text-xs text-muted-foreground">{c.ownerEmail ?? "No owner account"}</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {c.storeSlug && storefrontUrl(c.storeSlug, process.env.NEXT_PUBLIC_ROOT_DOMAIN) ? (
                  <a href={storefrontUrl(c.storeSlug, process.env.NEXT_PUBLIC_ROOT_DOMAIN)!} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {storefrontHost(c.storeSlug, process.env.NEXT_PUBLIC_ROOT_DOMAIN)}
                  </a>
                ) : (
                  (c.storeName ?? "—")
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{c.memberCount}</TableCell>
              <TableCell>
                <StatusBadge tone={c.status === "active" ? "active" : "warning"}>{c.status === "active" ? "Active" : "Suspended"}</StatusBadge>
              </TableCell>
              <TableCell className="hidden xl:table-cell">{date.format(c.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "created:desc", label: "Newest first" },
  { value: "created:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A to Z" },
  { value: "name:desc", label: "Name Z to A" },
];

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = orgListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { items: companies, total, page, pageSize } = await listCompaniesPage(query);
  const filtered = Boolean(query.q) || query.status !== "all";
  const create = (
    <Link href={ROUTES.adminNewCompany} className={buttonVariants()}>
      <PlusCircle aria-hidden /> Create organization
    </Link>
  );

  return (
    <>
      <PageHeader title="Organizations" description="Every organization on the platform." actions={total > 0 || filtered ? create : null} />
      {total === 0 && !filtered ? (
        <EmptyState icon={Building2} title="No organizations yet" description="Create an organization together with its owner account." action={create} />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search by name or address"
            filters={[{ key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] }]}
            sortOptions={SORT_OPTIONS}
          />
          {total === 0 ? (
            <EmptyState icon={SearchX} title="No organizations match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <OrganizationsTable companies={companies} />
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                basePath={ROUTES.adminCompanies}
                params={{ q: query.q, status: query.status, sort: query.sort, dir: query.dir, pageSize: String(pageSize) }}
                pageSizeOptions={ADMIN_PAGE_SIZES}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
