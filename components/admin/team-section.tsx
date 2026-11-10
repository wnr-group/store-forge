"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import { removeCompanyMemberAction, setCompanyMemberStatusAction } from "@/app/(admin)/admin/actions";
import { AddCompanyMember } from "@/components/admin/add-company-member";
import { TransferOwnershipDialog } from "@/components/admin/transfer-ownership-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { AccessSummary } from "@/components/team/access-summary";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabel } from "@/lib/auth/permissions";
import type { MemberPermissions, MembershipRole } from "@/lib/db/schema";

export type AdminMember = {
  userId: string;
  fullName: string | null;
  email: string;
  role: MembershipRole;
  status: "active" | "disabled";
  permissions: MemberPermissions;
};

type Pending = { kind: "toggle" | "remove"; member: AdminMember } | null;

/**
 * Platform Admin: an organization's team. Every action is re-authorised on the server and written to the audit log.
 * The owner row has no actions: ownership changes only through "Transfer ownership", which keeps exactly one owner.
 */
export function TeamSection({ tenantId, companyName, members }: { tenantId: string; companyName: string; members: AdminMember[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Pending>(null);
  const [transfer, setTransfer] = useState(false);
  const owner = members.find((m) => m.role === "owner") ?? null;
  const eligible = members.filter((m) => m.role !== "owner" && m.status === "active").map((m) => ({ userId: m.userId, label: `${m.fullName ?? m.email} (${m.email})` }));
  const label = (m: AdminMember) => `${m.fullName ?? m.email} (${m.email})`;
  const close = () => setTarget(null);

  return (
    <div className="space-y-4">
      {!owner ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm text-warning-text">
          <p>This organization has no owner, so nobody can manage its team. Appoint one to restore access.</p>
          <Button size="sm" onClick={() => setTransfer(true)}>
            <UserCog aria-hidden /> Appoint owner
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AddCompanyMember tenantId={tenantId} companyName={companyName} />
        {owner ? (
          <Button variant="outline" onClick={() => setTransfer(true)}>
            <UserCog aria-hidden /> Transfer ownership
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell>{m.fullName ?? "—"}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{roleLabel(m.role, m.permissions)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <AccessSummary role={m.role} permissions={m.permissions} />
                </TableCell>
                <TableCell>
                  <StatusBadge tone={m.status === "active" ? "active" : "draft"}>{m.status === "active" ? "Active" : "Disabled"}</StatusBadge>
                </TableCell>
                <TableCell>
                  {m.role === "owner" ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.email}`} />}>
                        <MoreHorizontal aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTarget({ kind: "toggle", member: m })}>
                          {m.status === "active" ? <UserX aria-hidden /> : <UserCheck aria-hidden />} {m.status === "active" ? "Disable" : "Reactivate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setTarget({ kind: "remove", member: m })}>
                          <Trash2 aria-hidden /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {target?.kind === "toggle" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={target.member.status === "active" ? "Disable member?" : "Reactivate member?"}
          description={
            target.member.status === "active"
              ? `${label(target.member)} will lose access to ${companyName} immediately. You can reactivate them later.`
              : `${label(target.member)} will be able to sign in and use ${companyName} again.`
          }
          confirmLabel={target.member.status === "active" ? "Disable" : "Reactivate"}
          successMessage="Member updated"
          onConfirm={async () => {
            const res = await setCompanyMemberStatusAction(tenantId, target.member.userId, target.member.status === "active" ? "disabled" : "active");
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
      {target?.kind === "remove" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title="Remove member?"
          description={`${label(target.member)} will be removed from ${companyName}. If they belong to no other organization their sign-in is deleted too. This cannot be undone.`}
          confirmLabel="Remove"
          successMessage="Member removed"
          onConfirm={async () => {
            const res = await removeCompanyMemberAction(tenantId, target.member.userId);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
      {transfer ? (
        <TransferOwnershipDialog
          key={`${owner?.userId ?? "none"}-${eligible.length}`}
          tenantId={tenantId}
          companyName={companyName}
          eligible={eligible}
          currentOwner={owner?.email ?? null}
          open
          onOpenChange={setTransfer}
        />
      ) : null}
    </div>
  );
}
