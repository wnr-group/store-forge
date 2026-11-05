"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MoreHorizontal, Pencil, PlusCircle, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  createMemberAction,
  removeMemberAction,
  resetMemberPasswordAction,
  setMemberStatusAction,
  updateMemberAction,
} from "@/app/(dashboard)/dashboard/team/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { ResetPasswordDialog } from "@/components/shared/reset-password-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/lib/auth/permissions";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/team";

export type MemberRow = {
  userId: string;
  fullName: string | null;
  email: string;
  role: "owner" | "admin" | "staff";
  status: "active" | "disabled";
  isSelf: boolean;
};

const RoleSelect = (p: { id: string; value: string; onChange: (v: AssignableRole) => void; disabled: boolean; invalid: boolean }) => (
  <NativeSelect id={p.id} value={p.value} onChange={(e) => p.onChange(e.target.value as AssignableRole)} disabled={p.disabled} aria-invalid={p.invalid} aria-describedby={`${p.id}-msg`}>
    {ASSIGNABLE_ROLES.map((r) => (
      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
    ))}
  </NativeSelect>
);

function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: "", email: "", password: "", role: "staff" as AssignableRole });
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const set = (k: keyof typeof v, value: string) => {
    setV((cur) => ({ ...cur, [k]: value }));
    clear(k);
  };
  const common = (k: "fullName" | "email" | "password", id: string) => ({
    id, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    onBlur: () => validateField(createMemberSchema, v, k), disabled: pending, "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(createMemberSchema, v)) return;
    send(async () => {
      const res = await createMemberAction(v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(`${res.data?.email ?? "Member"} can now sign in`);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Creates a sign-in for your company. No verification email is sent: share the email and initial password securely, and ask them to change it after first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id="tm-name" label="Member name" required error={errors.fullName}>
            <Input {...common("fullName", "tm-name")} aria-required autoComplete="off" autoFocus />
          </FormField>
          <FormField id="tm-email" label="Email" required error={errors.email}>
            <Input {...common("email", "tm-email")} type="email" aria-required autoComplete="off" />
          </FormField>
          <FormField id="tm-password" label="Initial password" required error={errors.password} hint="At least 8 characters with a letter and a number.">
            <PasswordInput {...common("password", "tm-password")} aria-required autoComplete="new-password" />
          </FormField>
          <FormField id="tm-role" label="Role" required error={errors.role} hint="Managers can also delete catalog items, customers and edit store settings; Staff can create and edit.">
            <RoleSelect id="tm-role" value={v.role} onChange={(r) => set("role", r)} disabled={pending} invalid={Boolean(errors.role)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Creating…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ userId: member.userId, fullName: member.fullName ?? "", role: (member.role === "owner" ? "staff" : member.role) as AssignableRole });
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();

  const submit = () => {
    if (!validate(updateMemberSchema, v)) return;
    send(async () => {
      const res = await updateMemberAction(v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Member updated");
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !pending && !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>{member.email}. The email address cannot be changed.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id="em-name" label="Member name" required error={errors.fullName}>
            <Input id="em-name" value={v.fullName} onChange={(e) => { setV({ ...v, fullName: e.target.value }); clear("fullName"); }} onBlur={() => validateField(updateMemberSchema, v, "fullName")} aria-invalid={Boolean(errors.fullName)} aria-describedby="em-name-msg" aria-required disabled={pending} autoFocus />
          </FormField>
          <FormField id="em-role" label="Role" required error={errors.role}>
            <RoleSelect id="em-role" value={v.role} onChange={(r) => { setV({ ...v, role: r }); clear("role"); }} disabled={pending} invalid={Boolean(errors.role)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Pending = { kind: "edit" | "reset" | "toggle" | "remove"; member: MemberRow } | null;

/** The Owner's team table. Every action is re-authorised on the server (Owner of the active tenant only). */
export function TeamManager({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Pending>(null);
  const close = () => setTarget(null);
  const label = (m: MemberRow) => `${m.fullName ?? m.email} (${m.email})`;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <PlusCircle aria-hidden /> Add member
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell>
                  <span className="font-medium">{m.fullName ?? "—"}</span>
                  {m.isSelf ? <span className="ml-1.5 text-xs text-muted-foreground">(you)</span> : null}
                  <span className="block text-xs text-muted-foreground sm:hidden">{m.email}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{m.email}</TableCell>
                <TableCell>{ROLE_LABELS[m.role]}</TableCell>
                <TableCell>
                  <StatusBadge tone={m.status === "active" ? "active" : "draft"}>{m.status === "active" ? "Active" : "Deactivated"}</StatusBadge>
                </TableCell>
                <TableCell>
                  {m.role === "owner" ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.email}`} />}>
                        <MoreHorizontal aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTarget({ kind: "edit", member: m })}><Pencil aria-hidden /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTarget({ kind: "reset", member: m })}><KeyRound aria-hidden /> Reset password</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTarget({ kind: "toggle", member: m })}>
                          {m.status === "active" ? <UserX aria-hidden /> : <UserCheck aria-hidden />} {m.status === "active" ? "Deactivate" : "Reactivate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setTarget({ kind: "remove", member: m })}><Trash2 aria-hidden /> Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {adding ? <AddMemberDialog key="add" open onOpenChange={setAdding} /> : null}
      {target?.kind === "edit" ? <EditMemberDialog key={target.member.userId} member={target.member} onClose={close} /> : null}
      {target?.kind === "reset" ? (
        <ResetPasswordDialog open onOpenChange={(o) => !o && close()} subject={label(target.member)} onSubmit={(password) => resetMemberPasswordAction(target.member.userId, { password })} />
      ) : null}
      {target?.kind === "toggle" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={target.member.status === "active" ? "Deactivate member?" : "Reactivate member?"}
          description={
            target.member.status === "active"
              ? `${label(target.member)} will lose access to your company immediately. You can reactivate them later.`
              : `${label(target.member)} will be able to sign in and use your company again.`
          }
          confirmLabel={target.member.status === "active" ? "Deactivate" : "Reactivate"}
          successMessage="Member updated"
          onConfirm={async () => {
            const res = await setMemberStatusAction(target.member.userId, target.member.status === "active" ? "disabled" : "active");
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
          description={`${label(target.member)} will be removed and their sign-in deleted. This cannot be undone.`}
          confirmLabel="Remove"
          successMessage="Member removed"
          onConfirm={async () => {
            const res = await removeMemberAction(target.member.userId);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
    </>
  );
}
