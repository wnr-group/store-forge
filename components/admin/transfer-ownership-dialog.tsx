"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { recoverCompanyOwnerAction, transferCompanyOwnershipAction } from "@/app/(admin)/admin/actions";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { recoverOwnerSchema, transferOwnershipSchema } from "@/lib/validations/admin-org";

export type EligibleMember = { userId: string; label: string };

type Props = {
  tenantId: string;
  companyName: string;
  /** Active team members (not the owner) who can take over. */
  eligible: EligibleMember[];
  /** The current owner's e-mail, or null when the organization has no owner. */
  currentOwner: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Platform Admin: change who owns an organization.
 *  - "Existing team member": a planned transfer to an active member.
 *  - "New owner account": recovery, for a lost or missing owner. Creates a new sign-in that becomes the owner.
 * The server does both in one transaction and re-checks everything; this dialog only collects the choice.
 */
export function TransferOwnershipDialog({ tenantId, companyName, eligible, currentOwner, open, onOpenChange }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"member" | "new">(eligible.length ? "member" : "new");
  const [userId, setUserId] = useState(eligible[0]?.userId ?? "");
  const [previousOwner, setPreviousOwner] = useState<"keep" | "disable">("keep");
  const [v, setV] = useState({ ownerName: "", ownerEmail: "", ownerPassword: "" });
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    clear(k);
  };

  const submit = () => {
    if (mode === "member") {
      const payload = { userId, previousOwner };
      if (!validate(transferOwnershipSchema, payload)) return;
      send(async () => {
        const res = await transferCompanyOwnershipAction(tenantId, payload);
        if (!res.ok) {
          fail(res);
          return;
        }
        toast.success("Ownership transferred");
        onOpenChange(false);
        router.refresh();
      });
      return;
    }
    const payload = { ...v, previousOwner };
    if (!validate(recoverOwnerSchema, payload)) return;
    send(async () => {
      const res = await recoverCompanyOwnerAction(tenantId, payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(`${res.data?.email ?? "The new owner"} can now sign in as owner`);
      onOpenChange(false);
      router.refresh();
    });
  };

  const hasOwner = currentOwner !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasOwner ? "Transfer ownership" : "Appoint an owner"}</DialogTitle>
          <DialogDescription>
            {hasOwner
              ? `Choose who owns ${companyName}. The current owner (${currentOwner}) becomes a team member. This is recorded in the audit log.`
              : `${companyName} has no owner. Appoint one to restore owner access. This is recorded in the audit log.`}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {formError ? (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          ) : null}

          <fieldset className="space-y-1.5" disabled={pending}>
            <legend className="text-sm font-medium">New owner</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="owner-mode" checked={mode === "member"} onChange={() => setMode("member")} disabled={eligible.length === 0} />
              An existing team member {eligible.length === 0 ? <span className="text-muted-foreground">(no active members available)</span> : null}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="owner-mode" checked={mode === "new"} onChange={() => setMode("new")} />
              A new owner account <span className="text-muted-foreground">(recovery)</span>
            </label>
          </fieldset>

          {mode === "member" ? (
            <FormField id="to-member" label="Team member" required error={errors.userId}>
              <NativeSelect id="to-member" value={userId} onChange={(e) => { setUserId(e.target.value); clear("userId"); }} disabled={pending} aria-invalid={Boolean(errors.userId)} aria-describedby="to-member-msg">
                {eligible.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <>
              <FormField id="to-name" label="Owner name" required error={errors.ownerName}>
                <Input id="to-name" value={v.ownerName} onChange={set("ownerName")} disabled={pending} aria-invalid={Boolean(errors.ownerName)} aria-describedby="to-name-msg" autoComplete="off" />
              </FormField>
              <FormField id="to-email" label="Owner email" required error={errors.ownerEmail}>
                <Input id="to-email" type="email" value={v.ownerEmail} onChange={set("ownerEmail")} disabled={pending} aria-invalid={Boolean(errors.ownerEmail)} aria-describedby="to-email-msg" autoComplete="off" />
              </FormField>
              <FormField id="to-pass" label="Initial password" required error={errors.ownerPassword} hint="At least 8 characters with a letter and a number. Share it securely; they should change it after signing in.">
                <PasswordInput id="to-pass" value={v.ownerPassword} onChange={set("ownerPassword")} disabled={pending} aria-invalid={Boolean(errors.ownerPassword)} aria-describedby="to-pass-msg" autoComplete="new-password" />
              </FormField>
            </>
          )}

          {hasOwner ? (
            <fieldset className="space-y-1.5" disabled={pending}>
              <legend className="text-sm font-medium">What happens to the current owner?</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="previous-owner" checked={previousOwner === "keep"} onChange={() => setPreviousOwner("keep")} />
                Keep them as a team member
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="previous-owner" checked={previousOwner === "disable"} onChange={() => setPreviousOwner("disable")} />
                Disable their access <span className="text-muted-foreground">(lost or compromised account)</span>
              </label>
            </fieldset>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || (mode === "member" && eligible.length === 0)}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : hasOwner ? "Transfer ownership" : "Appoint owner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
