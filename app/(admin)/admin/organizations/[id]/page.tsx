import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { z } from "zod";
import { CompanyControls } from "@/components/admin/company-controls";
import { EditOrganizationForm } from "@/components/admin/edit-organization-form";
import { StorePanel } from "@/components/admin/store-panel";
import { TenantPlanSection } from "@/components/admin/tenant-plan-section";
import { TeamSection } from "@/components/admin/team-section";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { getPlatformAccess } from "@/lib/auth/platform";
import { storefrontUrl } from "@/lib/tenant/host";
import { formatBytes } from "@/lib/utils/bytes";
import { getCompany } from "@/services/platform.service";
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
  // Usage is read alongside the organization. If it fails the page still opens and says so.
  const [found, usage, access] = await Promise.all([getCompany(id), getOrganizationUsage(id).catch(() => null), getPlatformAccess()]);
  // Roles that may only look (Billing, Support) get the same facts without controls that would be refused.
  const canManage = access?.permissions.includes("tenants:manage") ?? false;
  if (!found) notFound();
  const { company: c, store, team } = found;
  const storeUrl = store ? storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, c.publicId) : null;

  return (
    <>
      <PageHeader
        title={c.name}
        description={`Created ${date.format(c.createdAt)}`}
        actions={
          <>
            <StatusBadge tone={c.status === "active" ? "active" : "warning"}>{c.status === "active" ? "Active" : "Suspended"}</StatusBadge>
            {access?.permissions.includes("audit:read") ? (
              <Link href={`${ROUTES.adminActivity}?org=${c.id}`} className={buttonVariants({ variant: "outline" })}>
                <ScrollText aria-hidden /> View activity
              </Link>
            ) : null}
          </>
        }
      />
      <div className="space-y-6">
        {canManage ? (
          <SectionCard title="Organization status" description="Suspending an organization blocks access for all of its users and deletes nothing. Deleting removes it and its data for good.">
            <CompanyControls tenantId={c.id} companyName={c.name} status={c.status} />
          </SectionCard>
        ) : null}

        <SectionCard title="Organization details" description={canManage ? "The address (slug) and status cannot be edited here." : "Read only for your role."}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Created" value={date.format(c.createdAt)} />
            <Detail label="Identifier" value={c.slug} />
            <Detail label="Public ID" value={c.publicId} />
            <Detail label="Status" value={c.status === "active" ? "Active" : "Suspended"} />
          </dl>
          {canManage ? (
            <EditOrganizationForm key={`${c.name}|${c.contactPhone}|${c.address}`} tenantId={c.id} initial={{ name: c.name, contactPhone: c.contactPhone, address: c.address }} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Name" value={c.name} />
              <Detail label="Phone" value={c.contactPhone} />
              <Detail label="Address" value={c.address} />
            </dl>
          )}
        </SectionCard>

        <TenantPlanSection tenantId={c.id} />

        <SectionCard title="Store" description="The organization's storefront. To take it offline, suspend or delete the organization above.">
          {store && canManage ? (
            <StorePanel tenantId={c.id} storeUrl={storeUrl} store={store} />
          ) : store ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Name" value={store.name} />
              <Detail label="Address" value={store.slug} />
              <Detail label="Storefront" value={storeUrl ? <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{storeUrl}</a> : null} />
            </dl>
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

        <SectionCard title="Team" description={canManage ? "Created by the owner under Team members, or by you here. Passwords are never shown. Every change is recorded in the audit log." : "The people who can sign in to this organization."}>
          {canManage ? (
            <TeamSection
              tenantId={c.id}
              companyName={c.name}
              members={team.map((m) => ({ userId: m.userId, fullName: m.fullName, email: m.email, role: m.role, status: m.status, permissions: m.permissions }))}
            />
          ) : (
            <ul className="divide-y text-sm">
              {team.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span><span className="font-medium">{m.fullName ?? m.email}</span> <span className="text-muted-foreground">{m.fullName ? m.email : ""}</span></span>
                  <span className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner" : "Team member"} · {m.status === "active" ? "Active" : "Disabled"}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
