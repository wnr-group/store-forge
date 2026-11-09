"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, PlusCircle, ScrollText, ShieldCheck, ShieldMinus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addPlatformAdminAction, removePlatformAdminAction, setPlatformAdminRoleAction } from "@/app/(admin)/admin/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { addPlatformAdminSchema } from "@/lib/validations/admin-platform";

export type AdminView = {
  userId: string;
  email: string;
  fullName: string | null;
  role: "super_admin" | "admin";
  createdAt: string;
  createdByEmail: string | null;
};

const LEVELS = { super_admin: "Super admin", admin: "Admin" } as const;
const LEVEL_HINT = {
  super_admin: "Can do everything, including adding and removing admins and editing the platform settings.",
  admin: "Can manage organizations, stores and teams. Cannot manage other admins or the platform settings.",
} as const;

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function AddAdminDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: "", email: "", password: "", role: "admin" as "admin" | "super_admin" });
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    clear(k);
  };
  const common = (k: keyof typeof v, id: string) => ({
    id, value: v[k], onChange: set(k), onBlur: () => validateField(addPlatformAdminSchema, v, k), disabled: pending,
    "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(addPlatformAdminSchema, v)) return;
    send(async () => {
      const res = await addPlatformAdminAction(v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(`${res.data?.email ?? "The new admin"} can now sign in`);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add platform admin</DialogTitle>
          <DialogDescription>Creates a sign-in for platform staff. No email is sent: share the email and initial password securely and ask them to change it after signing in.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id="pa-name" label="Name" required error={errors.fullName}>
            <Input {...common("fullName", "pa-name")} autoComplete="off" autoFocus />
          </FormField>
          <FormField id="pa-email" label="Email" required error={errors.email}>
            <Input {...common("email", "pa-email")} type="email" autoComplete="off" />
          </FormField>
          <FormField id="pa-pass" label="Initial password" required error={errors.password} hint="At least 8 characters with a letter and a number.">
            <PasswordInput {...common("password", "pa-pass")} autoComplete="new-password" />
          </FormField>
          <FormField id="pa-role" label="Access level" required error={errors.role} hint={LEVEL_HINT[v.role]}>
            <NativeSelect {...common("role", "pa-role")}>
              <option value="admin">{LEVELS.admin}</option>
              <option value="super_admin">{LEVELS.super_admin}</option>
            </NativeSelect>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Creating…" : "Add admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Pending = { kind: "level" | "remove"; admin: AdminView } | null;

/**
 * Platform Admin accounts. Everyone with admin access can see the list; only a super admin gets the controls, and the server
 * (and the database) refuse anyone else. The last super admin cannot be demoted or removed.
 */
export function PlatformTeam({ admins, currentUserId, canManage }: { admins: AdminView[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Pending>(null);
  const supers = admins.filter((a) => a.role === "super_admin").length;
  const close = () => setTarget(null);

  return (
    <div className="space-y-4">
      {canManage ? (
        <div>
          <Button onClick={() => setAdding(true)}>
            <PlusCircle aria-hidden /> Add admin
          </Button>
        </div>
      ) : (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">You can see the platform team. Only a super admin can add, change or remove admins.</p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Access level</TableHead>
              <TableHead className="hidden md:table-cell">Added</TableHead>
              <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => {
              const isSelf = a.userId === currentUserId;
              const lastSuper = a.role === "super_admin" && supers <= 1;
              return (
                <TableRow key={a.userId}>
                  <TableCell>
                    <span className="font-medium">{a.fullName ?? "—"}</span>
                    {isSelf ? <span className="ml-1.5 text-xs text-muted-foreground">(you)</span> : null}
                  </TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>
                    <StatusBadge tone={a.role === "super_admin" ? "info" : "neutral"}>{LEVELS[a.role]}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {when.format(new Date(a.createdAt))}
                    {a.createdByEmail ? <span className="block text-xs">by {a.createdByEmail}</span> : null}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.email}`} />}>
                        <MoreHorizontal aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`${ROUTES.adminActivity}?admin=${a.userId}`} />}>
                          <ScrollText aria-hidden /> View activity
                        </DropdownMenuItem>
                        {canManage ? (
                          <>
                            <DropdownMenuItem disabled={lastSuper} onClick={() => setTarget({ kind: "level", admin: a })}>
                              {a.role === "super_admin" ? <ShieldMinus aria-hidden /> : <ShieldCheck aria-hidden />} {a.role === "super_admin" ? "Make admin" : "Make super admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" disabled={lastSuper} onClick={() => setTarget({ kind: "remove", admin: a })}>
                              <Trash2 aria-hidden /> {isSelf ? "Remove my access" : "Remove access"}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {canManage && supers <= 1 ? <p className="text-xs text-muted-foreground">There is one super admin. They cannot be demoted or removed until another super admin exists.</p> : null}

      {adding ? <AddAdminDialog open onOpenChange={setAdding} /> : null}
      {target?.kind === "level" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={target.admin.role === "super_admin" ? "Make this person an admin?" : "Make this person a super admin?"}
          description={
            target.admin.role === "super_admin"
              ? `${target.admin.email} will lose the ability to manage admins and the platform settings.`
              : `${target.admin.email} will be able to add and remove admins and edit the platform settings.`
          }
          confirmLabel={target.admin.role === "super_admin" ? "Make admin" : "Make super admin"}
          successMessage="Access level updated"
          onConfirm={async () => {
            const res = await setPlatformAdminRoleAction({ userId: target.admin.userId, role: target.admin.role === "super_admin" ? "admin" : "super_admin" });
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
      {target?.kind === "remove" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={target.admin.userId === currentUserId ? "Remove your own admin access?" : "Remove admin access?"}
          description={
            target.admin.userId === currentUserId
              ? "You will lose access to the platform admin area and your sign-in will be deleted. This cannot be undone."
              : `${target.admin.email} will lose all platform admin access and their sign-in will be deleted. This cannot be undone.`
          }
          confirmLabel="Remove access"
          confirmPhrase={target.admin.email}
          successMessage="Admin removed"
          onConfirm={async () => {
            const res = await removePlatformAdminAction(target.admin.userId);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
    </div>
  );
}
