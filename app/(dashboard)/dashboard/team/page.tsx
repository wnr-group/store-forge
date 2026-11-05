import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TeamManager } from "@/components/team/team-manager";
import { ROUTES } from "@/config/app";
import { canManageMembers } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { listTeam } from "@/services/team.service";

export const metadata: Metadata = { title: "Team members" };

export default async function TeamPage() {
  const { user, active } = await requireWorkspace();
  // Owner-only. The service and the database repeat this check; this is just the friendly redirect.
  if (!canManageMembers(active.role)) redirect(ROUTES.dashboard);
  const team = await listTeam();

  return (
    <>
      <TeamManager
        description={`People who can sign in to ${active.tenant.name}. Only you, the owner, can add or change them.`}
        members={team.map((m) => ({ ...m, isSelf: m.userId === user.id }))}
      />
    </>
  );
}
