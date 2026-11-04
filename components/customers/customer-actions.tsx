"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCustomerAction } from "@/app/(dashboard)/dashboard/customers/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { CustomerDialog } from "./customer-dialog";

type Customer = { id: string; fullName: string; email: string; phone: string | null; notes: string | null };

/** "Add customer" button for the list page. */
export function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add customer
      </Button>
      {open ? <CustomerDialog open onOpenChange={setOpen} /> : null}
    </>
  );
}

/** Edit / delete controls for the detail page. */
export function CustomerDetailActions({ customer, canManage, canDelete }: { customer: Customer; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  return (
    <>
      {canManage ? (
        <Button variant="outline" onClick={() => setEdit(true)}>
          <Pencil aria-hidden /> Edit
        </Button>
      ) : null}
      {canDelete ? (
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDel(true)}>
          <Trash2 aria-hidden /> Delete
        </Button>
      ) : null}
      {edit ? <CustomerDialog open onOpenChange={setEdit} customer={customer} /> : null}
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`Delete ${customer.fullName}?`}
        description="The customer record is removed. Their past orders are kept for your records."
        confirmLabel="Delete customer"
        onConfirm={async () => {
          const res = await deleteCustomerAction(customer.id);
          if (res.ok) {
            toast.success("Customer deleted");
            router.replace(ROUTES.customers);
          }
          return res;
        }}
      />
    </>
  );
}
