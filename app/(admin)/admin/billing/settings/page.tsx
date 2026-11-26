import type { Metadata } from "next";
import { BillingSettingsForm } from "@/components/admin/billing-settings-form";
import { BillingTabs } from "@/components/admin/billing-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { getPlatformAccess, requirePlatformPagePermission } from "@/lib/auth/platform";
import { getBillingSettings } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Billing settings" };

export default async function BillingSettingsPage() {
  await requirePlatformPagePermission("billing:read");
  const [settings, access] = await Promise.all([getBillingSettings(), getPlatformAccess()]);
  return (
    <>
      <PageHeader title="Billing settings" description="What invoices say about Kanova Store as the seller, the tax added to plan prices, and how renewals behave." />
      <BillingTabs />
      <BillingSettingsForm key={settings.updatedAt} initial={settings} canEdit={access?.permissions.includes("billing:manage") ?? false} />
    </>
  );
}
