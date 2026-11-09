import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { z } from "zod";
import { CompanyControls } from "@/components/admin/company-controls";
import { EditOrganizationForm } from "@/components/admin/edit-organization-form";
import { StorePanel } from "@/components/admin/store-panel";
import { TeamSection } from "@/components/admin/team-section";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { storefrontUrl } from "@/lib/tenant/host";
import { getCompany } from "@/services/platform.service";

export const metadata: Metadata = { title: "Organization details" };

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
  const { company: c, store, team } = found;
  const storeUrl = store ? storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN) : null;

  return (
    <>
      <PageHeader
        title={c.name}
        description={`Created ${date.format(c.createdAt)}`}
        actions={
          <>
            <StatusBadge tone={c.status === "active" ? "active" : "warning"}>{c.status === "active" ? "Active" : "Suspended"}</StatusBadge>
            <Link href={`${ROUTES.adminActivity}?org=${c.id}`} className={buttonVariants({ variant: "outline" })}>
              <ScrollText aria-hidden /> View activity
            </Link>
          </>
        }
      />
      <div className="space-y-6">
        <SectionCard title="Organization status" description="Suspending an organization blocks access for all of its users and deletes nothing. Deleting removes it and its data for good.">
          <CompanyControls tenantId={c.id} companyName={c.name} status={c.status} />
        </SectionCard>

        <SectionCard title="Organization details" description="The address (slug) and status cannot be edited here.">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Created" value={date.format(c.createdAt)} />
            <Detail label="Identifier" value={c.slug} />
            <Detail label="Status" value={c.status === "active" ? "Active" : "Suspended"} />
          </dl>
          <EditOrganizationForm key={`${c.name}|${c.contactPhone}|${c.address}`} tenantId={c.id} initial={{ name: c.name, contactPhone: c.contactPhone, address: c.address }} />
        </SectionCard>

        <SectionCard title="Store" description="The organization's storefront. Its status is separate from the organization's status.">
          {store ? (
            <StorePanel tenantId={c.id} organizationStatus={c.status} storeUrl={storeUrl} store={store} />
          ) : (
            <p className="text-sm text-muted-foreground">This organization does not have a store.</p>
          )}
        </SectionCard>

        <SectionCard title="Team" description="Created by the owner under Team members, or by you here. Passwords are never shown. Every change is recorded in the audit log.">
          <TeamSection
            tenantId={c.id}
            companyName={c.name}
            members={team.map((m) => ({ userId: m.userId, fullName: m.fullName, email: m.email, role: m.role, status: m.status, permissions: m.permissions }))}
          />
        </SectionCard>
      </div>
    </>
  );
}
