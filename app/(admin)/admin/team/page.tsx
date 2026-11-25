import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PlatformTeam } from "@/components/admin/platform-team";
import { getPlatformAdminLevel, requirePlatformPagePermission } from "@/lib/auth/platform";
import { getCurrentUser } from "@/lib/auth/session";
import { listPlatformAdmins } from "@/services/platform-team.service";

export const metadata: Metadata = { title: "Platform administrators" };

export default async function PlatformTeamPage() {
  await requirePlatformPagePermission("admins:read");
  const [admins, level, user] = await Promise.all([listPlatformAdmins(), getPlatformAdminLevel(), getCurrentUser()]);

  return (
    <>
      <PageHeader title="Platform administrators" description="The people who can sign in to this admin area, and what each role may do. Every change is recorded in the audit log." />
      <PlatformTeam
        currentUserId={user?.id ?? ""}
        canManage={level === "super_admin"}
        admins={admins.map((a) => ({
          userId: a.userId,
          email: a.email,
          fullName: a.fullName,
          role: a.role,
          createdAt: a.createdAt.toISOString(),
          createdByEmail: a.createdByEmail,
        }))}
      />
    </>
  );
}
