import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import { getPlatformAdminLevel } from "@/lib/auth/platform";
import { getPlatformSettings } from "@/services/platform-settings.service";

export const metadata: Metadata = { title: "Platform Settings" };

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function PlatformSettingsPage() {
  const [settings, level] = await Promise.all([getPlatformSettings(), getPlatformAdminLevel()]);

  return (
    <>
      <PageHeader title="Platform Settings" description="Values that apply across the whole platform. Changes are recorded in the audit log." />
      <PlatformSettingsForm
        // remount with fresh values after a save
        key={`${settings.updatedAt.getTime()}`}
        canEdit={level === "super_admin"}
        updatedLine={`Last changed ${when.format(settings.updatedAt)}${settings.updatedByEmail ? ` by ${settings.updatedByEmail}` : ""}.`}
        initial={{
          platformName: settings.platformName,
          supportEmail: settings.supportEmail,
          defaultCurrency: settings.defaultCurrency,
          defaultTimezone: settings.defaultTimezone,
          defaultStoreStatus: settings.defaultStoreStatus,
        }}
      />
    </>
  );
}
