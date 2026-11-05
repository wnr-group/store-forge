import type { Metadata } from "next";
import Link from "next/link";
import { Building2, PlusCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { listCompanies } from "@/services/platform.service";

export const metadata: Metadata = { title: "Companies" };

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function CompaniesPage() {
  const companies = await listCompanies();
  const create = (
    <Link href={ROUTES.adminNewCompany} className={buttonVariants()}>
      <PlusCircle aria-hidden /> Create organization
    </Link>
  );

  return (
    <>
      <PageHeader title="Companies" description="Every company on the platform." actions={companies.length ? create : null} />
      {companies.length === 0 ? (
        <EmptyState icon={Building2} title="No companies yet" description="Create a company together with its owner account." action={create} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Company</TableHead>
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
      )}
    </>
  );
}
