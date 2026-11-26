"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDiscountAction, getDiscountAction, setDiscountActiveAction } from "@/app/(dashboard)/dashboard/marketing/discounts/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { DiscountDetailApi } from "@/lib/api/endpoints/marketing-api";
import { DiscountDialog, type DiscountDialogContext } from "./discount-dialog";

/** "Create discount code" button for the list page. */
export function AddDiscountButton({ ctx }: { ctx: DiscountDialogContext }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Create discount code
      </Button>
      {open ? <DiscountDialog open onOpenChange={setOpen} ctx={ctx} /> : null}
    </>
  );
}

/** One row's controls: the on/off switch, edit (loads the full code with its products and collections) and delete. */
export function DiscountRowActions({ id, code, isActive, used, canManage, ctx }: { id: string; code: string; isActive: boolean; used: boolean; canManage: boolean; ctx: DiscountDialogContext }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<DiscountDetailApi | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggle = (on: boolean) =>
    start(async () => {
      const res = await setDiscountActiveAction(id, on);
      if (!res.ok) return void toast.error(res.error);
      toast.success(on ? `${code} is on` : `${code} is off`);
      router.refresh();
    });
  const edit = () =>
    start(async () => {
      const res = await getDiscountAction(id);
      if (!res.ok || !res.data) return void toast.error(res.ok ? "That code no longer exists." : res.error);
      setDetail(res.data);
    });

  if (!canManage) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      <Switch checked={isActive} onCheckedChange={toggle} disabled={pending} aria-label={`${code} on or off`} />
      <Button variant="ghost" size="icon-sm" onClick={edit} disabled={pending} aria-label={`Edit ${code}`}>
        <Pencil aria-hidden />
      </Button>
      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)} disabled={pending} aria-label={`Delete ${code}`}>
        <Trash2 aria-hidden />
      </Button>
      {detail ? <DiscountDialog key={detail.id} open onOpenChange={(o) => !o && setDetail(null)} discount={detail} ctx={ctx} /> : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${code}?`}
        description={used ? "This code has been used on orders, so it cannot be deleted. Switch it off instead; it then stops working at once and its history stays." : "The code stops working and is removed. This cannot be undone."}
        confirmLabel="Delete code"
        successMessage="Discount code deleted"
        onConfirm={async () => {
          const res = await deleteDiscountAction(id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
