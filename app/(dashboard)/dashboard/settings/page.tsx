import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { StoreSettingsForm } from "@/components/settings/store-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageStore, ROLE_LABELS } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { getOwnProfile } from "@/services/profile.service";
import { isCurrencyLocked } from "@/services/store-settings.service";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, active, store } = await requireWorkspace();
  const [profile, locked] = await Promise.all([getOwnProfile(), isCurrencyLocked()]);

  return (
    <>
      <PageHeader title="Settings" description={`${active.tenant.name} · you are ${active.role === "owner" ? "the owner" : "a team member"}`} />
      <div className="max-w-5xl divide-y">
        {store ? (
          <StoreSettingsForm key={store.updatedAt.toISOString()} store={store} publicId={active.tenant.publicId} canEdit={canManageStore(active)} currencyLocked={locked} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No store yet</CardTitle>
              <CardDescription>This workspace does not have a store.</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        )}
        <ProfileForm fullName={profile.fullName ?? ""} email={user.email ?? ""} role={ROLE_LABELS[active.role]} />
        <ChangePasswordForm />
      </div>
    </>
  );
}
