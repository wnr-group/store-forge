import type { Metadata } from "next";
import { PlanForm } from "@/components/admin/plan-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import { getPlanCatalog } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Create plan" };

export default async function NewPlanPage() {
  await requirePlatformPagePermission("plans:manage");
  const catalog = await getPlanCatalog();
  return (
    <>
      <PageHeader title="Create plan" description="Set the price, trial, features and limits. You can change all of this later except the code." />
      <PlanForm catalog={catalog} canEdit />
    </>
  );
}
