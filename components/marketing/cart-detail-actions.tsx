"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAbandonedCartAction } from "@/app/(dashboard)/dashboard/marketing/abandoned-carts/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";

/** Copy the recovery link, and erase the cart (with its customer details) after a confirmation. */
export function CartDetailActions({ id, link, canManage }: { id: string; link: string | null; canManage: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [erasing, setErasing] = useState(false);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy. Select the link and copy it yourself.");
    }
  };

  return (
    <>
      {link ? (
        <Button variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy recovery link"}
        </Button>
      ) : null}
      {canManage ? (
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setErasing(true)}>
          <Trash2 aria-hidden /> Erase
        </Button>
      ) : null}
      <ConfirmDialog
        open={erasing}
        onOpenChange={setErasing}
        title="Erase this saved cart?"
        description="The cart and the customer details kept with it are permanently deleted, and its recovery link stops working. Use this when a customer asks for their data to be removed."
        confirmLabel="Erase cart"
        successMessage="Saved cart erased"
        onConfirm={async () => {
          const res = await deleteAbandonedCartAction(id);
          if (res.ok) router.push(ROUTES.abandonedCarts);
          return res;
        }}
      />
    </>
  );
}
