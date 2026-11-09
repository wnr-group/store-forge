"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { addCompanyMemberAction } from "@/app/(admin)/admin/actions";
import { AddMemberDialog } from "@/components/team/team-manager";
import { Button } from "@/components/ui/button";

/** Platform Admin: add a Manager/Staff sign-in to one company. The server re-checks the admin on submit. */
export function AddCompanyMember({ tenantId, companyName }: { tenantId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusCircle aria-hidden /> Add team member
      </Button>
      {open ? (
        <AddMemberDialog
          open
          onOpenChange={setOpen}
          create={(v) => addCompanyMemberAction(tenantId, v)}
          description={`Creates a sign-in for ${companyName}. No verification email is sent: share the email and initial password securely, and ask them to change it after first sign-in.`}
        />
      ) : null}
    </>
  );
}
