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
import { AccessSummary } from "@/components/team/access-summary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { PasswordInput } from "@/components/shared/password-input";
import { ResetPasswordDialog } from "@/components/shared/reset-password-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEVEL_LABELS, MODULE_LABELS, presetOf, ROLE_PRESET_KEYS, ROLE_PRESETS, roleLabel } from "@/lib/auth/permissions";
import { MODULES, type AccessLevel, type MemberPermissions } from "@/lib/domain/enums";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { createMemberSchema, updateMemberSchema, type CreateMemberInput, type PermissionsInput } from "@/lib/validations/team";

export type MemberRow = {
  userId: string;
  fullName: string | null;
  email: string;
  role: "owner" | "admin" | "staff";
  status: "active" | "disabled";
  permissions: MemberPermissions;
  isSelf: boolean;
};

/** Stored permissions -> the full set of levels the form edits (missing module = none; settings are always readable). */
const toForm = (p: MemberPermissions): PermissionsInput => ({
  products: (p.products ?? "none") as PermissionsInput["products"],
  orders: (p.orders === "write" ? "read" : (p.orders ?? "none")) as PermissionsInput["orders"],
  customers: (p.customers ?? "none") as PermissionsInput["customers"],
  settings: (p.settings === "write" ? "write" : "read") as PermissionsInput["settings"],
});

/**
 * Role = a preset for the access rows below. Picking one fills them in; changing a row afterwards makes the role
 * read "Custom". Only the access levels are saved, so the role is always derived from them.
 */
function RoleField({ id, value, onChange, disabled }: { id: string; value: PermissionsInput; onChange: (v: PermissionsInput) => void; disabled: boolean }) {
  const current = presetOf(value);
  return (
    <FormField id={id} label="Role" required hint={current === "custom" ? "Access was adjusted below. Pick a role to reset it." : ROLE_PRESETS[current].hint}>
      <NativeSelect
        id={id}
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const key = e.target.value;
          if (key !== "custom") onChange({ ...ROLE_PRESETS[key as keyof typeof ROLE_PRESETS].permissions } as PermissionsInput);
        }}
      >
        {ROLE_PRESET_KEYS.map((k) => (
          <option key={k} value={k}>{ROLE_PRESETS[k].label}</option>
        ))}
        {current === "custom" ? <option value="custom">Custom</option> : null}
      </NativeSelect>
    </FormField>
  );
}

/** One access level per module. The Owner can raise or revoke any of them at any time. */
function PermissionFields({ idPrefix, value, onChange, disabled, error }: { idPrefix: string; value: PermissionsInput; onChange: (v: PermissionsInput) => void; disabled: boolean; error?: string }) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">Access</legend>
      <p className="text-xs text-muted-foreground">Choose what this person can see and change. You can change or revoke it at any time.</p>
      {MODULES.map((m) => (
        <div key={m} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <label htmlFor={`${idPrefix}-${m}`} className="min-w-0">
            <span className="block text-sm font-medium">{MODULE_LABELS[m].label}</span>
            <span className="block text-xs text-muted-foreground">{MODULE_LABELS[m].hint}</span>
          </label>
          <div className="w-36 shrink-0">
            <NativeSelect id={`${idPrefix}-${m}`} value={value[m]} onChange={(e) => onChange({ ...value, [m]: e.target.value as AccessLevel })}>
              {MODULE_LABELS[m].levels.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
      ))}
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    </fieldset>
  );
}

type AddMemberDialogProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Defaults to the Owner's own-tenant action; the Platform Admin passes one bound to a company. */
  create?: (v: CreateMemberInput) => ReturnType<typeof createMemberAction>;
  description?: string;
};

export function AddMemberDialog({ open, onOpenChange, create = createMemberAction, description = "Creates a sign-in for your company. No verification email is sent: share the email and initial password securely, and ask them to change it after first sign-in." }: AddMemberDialogProps) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: "", email: "", password: "" });
  const [permissions, setPermissions] = useState<PermissionsInput>({ ...ROLE_PRESETS.viewer.permissions } as PermissionsInput);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const set = (k: keyof typeof v, value: string) => {
    setV((cur) => ({ ...cur, [k]: value }));
    clear(k);
  };
  const common = (k: "fullName" | "email" | "password", id: string) => ({
    id, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    onBlur: () => validateField(createMemberSchema, { ...v, permissions }, k), disabled: pending, "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    const payload = { ...v, permissions };
    if (!validate(createMemberSchema, payload)) return;
    send(async () => {
      const res = await create(payload);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
          <RoleField id="tm-role" value={permissions} onChange={setPermissions} disabled={pending} />
          <PermissionFields idPrefix="tm-perm" value={permissions} onChange={setPermissions} disabled={pending} error={errors.permissions} />
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
  const [v, setV] = useState({ userId: member.userId, fullName: member.fullName ?? "", permissions: toForm(member.permissions) });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit member and access</DialogTitle>
          <DialogDescription>{member.email}. The email address cannot be changed.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id="em-name" label="Member name" required error={errors.fullName}>
            <Input id="em-name" value={v.fullName} onChange={(e) => { setV({ ...v, fullName: e.target.value }); clear("fullName"); }} onBlur={() => validateField(updateMemberSchema, v, "fullName")} aria-invalid={Boolean(errors.fullName)} aria-describedby="em-name-msg" aria-required disabled={pending} autoFocus />
          </FormField>
          <RoleField id="em-role" value={v.permissions} onChange={(permissions) => setV({ ...v, permissions })} disabled={pending} />
          <PermissionFields idPrefix="em-perm" value={v.permissions} onChange={(permissions) => setV({ ...v, permissions })} disabled={pending} error={errors.permissions} />
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
export function TeamManager({ members, description }: { members: MemberRow[]; description: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Pending>(null);
  const close = () => setTarget(null);
  const label = (m: MemberRow) => `${m.fullName ?? m.email} (${m.email})`;

  return (
    <>
      <PageHeader
        title="Team members"
        description={description}
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusCircle aria-hidden /> Add member
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead className="hidden md:table-cell">Access</TableHead>
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
                <TableCell className="hidden sm:table-cell">{roleLabel(m.role, m.permissions)}</TableCell>
                <TableCell className="hidden md:table-cell"><AccessSummary role={m.role} permissions={m.permissions} /></TableCell>
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
                        <DropdownMenuItem onClick={() => setTarget({ kind: "edit", member: m })}><Pencil aria-hidden /> Edit access</DropdownMenuItem>
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
