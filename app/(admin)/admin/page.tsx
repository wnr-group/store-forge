import type { Metadata } from "next";
import Link from "next/link";
import { Building2, PauseCircle, PlusCircle, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/config/app";
import { getPlatformOverview } from "@/services/platform.service";

export const metadata: Metadata = { title: "Platform overview" };

export default async function AdminOverviewPage() {
  const overview = await getPlatformOverview();
  const stats = [
    { label: "Organizations", value: overview.totalOrganizations, icon: Building2 },
    { label: "Active", value: overview.active, icon: Building2 },
    { label: "Suspended", value: overview.suspended, icon: PauseCircle },
    { label: "User accounts", value: overview.totalUsers, icon: Users },
  ];

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Organizations using StoreForge. Only you can create organizations and their owner accounts."
        actions={
          <Link href={ROUTES.adminNewCompany} className={buttonVariants()}>
            <PlusCircle aria-hidden /> Create organization
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <Icon className="size-5 text-muted-foreground" aria-hidden />
            </CardContent>
          </Card>
        ))}
      </div>
      <SectionCard title="Recently created" className="mt-6">
        {overview.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations yet. Create the first one to onboard its owner.</p>
        ) : (
          <ul className="divide-y">
            {overview.recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`${ROUTES.adminCompanies}/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                <span className="truncate text-muted-foreground">{c.ownerEmail ?? "No owner"}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
