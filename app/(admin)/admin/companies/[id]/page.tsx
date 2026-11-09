import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AddCompanyMember } from "@/components/admin/add-company-member";
import { CompanyControls } from "@/components/admin/company-controls";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { storefrontUrl } from "@/lib/tenant/host";
import { getCompany } from "@/services/platform.service";

export const metadata: Metadata = { title: "Company details" };

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm">{value || "—"}</dd>
  </div>
);

export default async function CompanyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const found = await getCompany(id);
  if (!found) notFound();
  const { company: c, team } = found;
  const storeUrl = c.storeSlug ? storefrontUrl(c.storeSlug, process.env.NEXT_PUBLIC_ROOT_DOMAIN) : null;

  return (
    <>
      <PageHeader
        title={c.name}
        description={`Created ${date.format(c.createdAt)}`}
        actions={<StatusBadge tone={c.status === "active" ? "active" : "warning"}>{c.status === "active" ? "Active" : "Suspended"}</StatusBadge>}
      />
      <div className="space-y-6">
        <SectionCard title="Status" description="Suspending a company blocks access for all of its users. Nothing is deleted.">
          <CompanyControls
            tenantId={c.id}
            companyName={c.name}
            status={c.status}
            ownerLabel={c.ownerEmail ? `${c.ownerName ?? "the owner"} (${c.ownerEmail})` : null}
          />
        </SectionCard>

        <SectionCard title="Details">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Company" value={c.name} />
            <Detail label="Contact number" value={c.contactPhone} />
            <Detail label="Address" value={c.address} />
            <Detail label="Store" value={c.storeName ? `${c.storeName} (${c.storeSlug})` : null} />
            <Detail label="Storefront" value={storeUrl ? <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{storeUrl}</a> : null} />
            <Detail label="Owner" value={c.ownerName} />
            <Detail label="Owner email" value={c.ownerEmail} />
          </dl>
        </SectionCard>

        <SectionCard title="User accounts" description="Created by the owner under Team members, or by you here. Passwords are never shown.">
          <div className="mb-3"><AddCompanyMember tenantId={c.id} companyName={c.name} /></div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>{m.fullName ?? "—"}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{ROLE_LABELS[m.role]}</TableCell>
                    <TableCell>
                      <StatusBadge tone={m.status === "active" ? "active" : "draft"}>{m.status === "active" ? "Active" : "Deactivated"}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
