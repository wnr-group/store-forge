"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { deleteCompanyAction, setCompanyStatusAction } from "@/app/(admin)/admin/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";

type Props = { tenantId: string; companyName: string; status: "active" | "suspended" };

/** Platform Admin controls for one organization. Authorisation is re-checked on the server by every action. */
export function CompanyControls({ tenantId, companyName, status }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const suspending = status === "active";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={suspending ? "outline" : "default"} onClick={() => setConfirm(true)}>
        {suspending ? <PauseCircle aria-hidden /> : <PlayCircle aria-hidden />} {suspending ? "Suspend organization" : "Reactivate organization"}
      </Button>
      <Button variant="destructive" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden /> Delete organization
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
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${companyName}?`}
        description="This permanently deletes the organization, its store, products, images, customers and orders, and the sign-ins of everyone who belongs only to it. It cannot be undone."
        confirmLabel="Delete organization"
        confirmPhrase={companyName}
        successMessage="Organization deleted"
        onConfirm={async () => {
          const res = await deleteCompanyAction(tenantId);
          if (res.ok) router.replace(ROUTES.adminCompanies);
          return res;
        }}
      />
    </div>
  );
}
