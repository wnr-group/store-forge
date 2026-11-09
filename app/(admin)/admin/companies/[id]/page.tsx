import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { z } from "zod";
import { CompanyControls } from "@/components/admin/company-controls";
import { EditOrganizationForm } from "@/components/admin/edit-organization-form";
import { StorePanel } from "@/components/admin/store-panel";
import { SupportNotes } from "@/components/admin/support-notes";
import { TeamSection } from "@/components/admin/team-section";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { storefrontUrl } from "@/lib/tenant/host";
import { formatBytes } from "@/lib/utils/bytes";
import { getCompany } from "@/services/platform.service";
import { listSupportNotes } from "@/services/platform-support.service";
import { getOrganizationUsage } from "@/services/platform-usage.service";

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
  // Usage and notes are read alongside the organization. If either fails the page still opens and says so.
  const [found, usage, notes] = await Promise.all([
    getCompany(id),
    getOrganizationUsage(id).catch(() => null),
    listSupportNotes({ tenantId: id, page: 1, pageSize: 10 }).catch(() => null),
  ]);
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

        <SectionCard title="Usage" description="Totals only: no customer, order or product details are shown. This is read-only.">
          {usage ? (
            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Detail label="Products" value={String(usage.products)} />
              <Detail label="Customers" value={String(usage.customers)} />
              <Detail label="Orders" value={String(usage.orders)} />
              <Detail label="Storage used" value={usage.storageBytes === null ? <span className="text-muted-foreground">Not available</span> : formatBytes(usage.storageBytes)} />
              <Detail label="Last activity" value={usage.lastActivity ? date.format(usage.lastActivity) : <span className="text-muted-foreground">No activity yet</span>} />
              <Detail label="Created" value={date.format(usage.createdAt)} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Usage could not be loaded right now. Refresh to try again.</p>
          )}
        </SectionCard>

        <SectionCard title="Team" description="Created by the owner under Team members, or by you here. Passwords are never shown. Every change is recorded in the audit log.">
          <TeamSection
            tenantId={c.id}
            companyName={c.name}
            members={team.map((m) => ({ userId: m.userId, fullName: m.fullName, email: m.email, role: m.role, status: m.status, permissions: m.permissions }))}
          />
        </SectionCard>

        <SectionCard title="Support notes" description="Internal notes for the platform team. The organization never sees these.">
          {notes ? (
            <SupportNotes
              tenantId={c.id}
              total={notes.total}
              notes={notes.notes.map((n) => ({ id: n.id, authorEmail: n.authorEmail, body: n.body, createdAt: n.createdAt.toISOString(), edited: n.edited, canEdit: n.canEdit }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Notes could not be loaded right now. Refresh to try again.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
