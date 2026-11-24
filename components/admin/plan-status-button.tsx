"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPlanStatusAction } from "@/app/(admin)/admin/commercial-actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Activate or deactivate a plan. A deactivated plan can no longer be given to tenants; tenants already on it keep it. */
export function PlanStatusButton({ planId, planName, status, isDefault, subscribers }: { planId: string; planName: string; status: "active" | "inactive"; isDefault: boolean; subscribers: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const next = status === "active" ? "inactive" : "active";
  const blocked = status === "active" && isDefault;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={blocked}
        title={blocked ? "The default plan cannot be deactivated. Make another plan the default first." : undefined}
      >
        {status === "active" ? "Deactivate" : "Activate"}
      </Button>
      {open ? (
        <ConfirmDialog
          open
          onOpenChange={setOpen}
          title={next === "inactive" ? `Deactivate ${planName}?` : `Activate ${planName}?`}
          description={
            next === "inactive"
              ? `It can no longer be given to tenants. ${subscribers > 0 ? `The ${subscribers} tenant${subscribers === 1 ? "" : "s"} already on it keep${subscribers === 1 ? "s" : ""} it.` : "No tenant is on it."}`
              : "It can be given to tenants again."
          }
          confirmLabel={next === "inactive" ? "Deactivate" : "Activate"}
          successMessage={next === "inactive" ? "Plan deactivated" : "Plan activated"}
          onConfirm={async () => {
            const res = await setPlanStatusAction(planId, next);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
    </>
  );
}
