"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, PauseCircle, PlayCircle } from "lucide-react";
import { resetOwnerPasswordAction, setCompanyStatusAction } from "@/app/(admin)/admin/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResetPasswordDialog } from "@/components/shared/reset-password-dialog";
import { Button } from "@/components/ui/button";

type Props = { tenantId: string; companyName: string; status: "active" | "suspended"; ownerLabel: string | null };

/** Platform Admin controls for one organization. Authorisation is re-checked on the server by every action. */
export function CompanyControls({ tenantId, companyName, status, ownerLabel }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [reset, setReset] = useState(false);
  const suspending = status === "active";

  return (
    <div className="flex flex-wrap gap-2">
      {ownerLabel ? (
        <Button variant="outline" onClick={() => setReset(true)}>
          <KeyRound aria-hidden /> Reset owner password
        </Button>
      ) : null}
      <Button variant={suspending ? "destructive" : "default"} onClick={() => setConfirm(true)}>
        {suspending ? <PauseCircle aria-hidden /> : <PlayCircle aria-hidden />} {suspending ? "Suspend organization" : "Reactivate organization"}
      </Button>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={suspending ? `Suspend ${companyName}?` : `Reactivate ${companyName}?`}
        description={
          suspending
            ? "Everyone in this organization loses access immediately. Their data is kept and nothing is deleted."
            : "Everyone in this organization regains access with their existing accounts."
        }
        confirmLabel={suspending ? "Suspend" : "Reactivate"}
        successMessage={suspending ? "Organization suspended" : "Organization reactivated"}
        onConfirm={async () => {
          const res = await setCompanyStatusAction(tenantId, suspending ? "suspended" : "active");
          if (res.ok) router.refresh();
          return res;
        }}
      />
      {ownerLabel ? (
        <ResetPasswordDialog
          key={reset ? "open" : "closed"}
          open={reset}
          onOpenChange={setReset}
          subject={ownerLabel}
          onSubmit={(password) => resetOwnerPasswordAction(tenantId, { password })}
        />
      ) : null}
    </div>
  );
}
