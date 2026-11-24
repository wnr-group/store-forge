import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PlanForm } from "@/components/admin/plan-form";
import { PlanStatusButton } from "@/components/admin/plan-status-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AppError } from "@/lib/errors";
import { getPlatformAccess, requirePlatformPagePermission } from "@/lib/auth/platform";
import { getPlan, getPlanCatalog } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Plan details" };

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformPagePermission("plans:read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [plan, catalog, access] = await Promise.all([
    getPlan(id).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") return null;
      throw e;
    }),
    getPlanCatalog(),
    getPlatformAccess(),
  ]);
  if (!plan) notFound();
  const canManage = access?.permissions.includes("plans:manage") ?? false;

  return (
    <>
      <PageHeader
        title={plan.name}
        description={`${plan.code} · ${plan.subscriberCount} tenant${plan.subscriberCount === 1 ? "" : "s"} on this plan`}
        actions={
          <>
            <StatusBadge tone={plan.status === "active" ? "active" : "draft"}>{plan.status === "active" ? "Active" : "Inactive"}</StatusBadge>
            {canManage ? <PlanStatusButton planId={plan.id} planName={plan.name} status={plan.status} isDefault={plan.isDefault} subscribers={plan.subscriberCount} /> : null}
          </>
        }
      />
      <PlanForm key={plan.updatedAt} catalog={catalog} plan={plan} canEdit={canManage} />
    </>
  );
}
