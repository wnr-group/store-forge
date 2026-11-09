"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/types/action";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Returns the server action result; the dialog shows errors and closes on success. */
  onConfirm: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
  /** For irreversible actions: the user must type this exact text before the confirm button works. */
  confirmPhrase?: string;
};

/** Confirmation for destructive actions. Stays open and shows the error if the action fails. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, successMessage, confirmPhrase }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const phraseId = useId();
  const matches = !confirmPhrase || typed.trim() === confirmPhrase;

  /** Every way of closing goes through here, so the typed text and any error never carry over to the next opening. */
  const change = (o: boolean) => {
    if (!o) {
      setTyped("");
      setError(null);
    }
    onOpenChange(o);
  };

  const confirm = () =>
    startTransition(async () => {
      if (!matches) return;
      setError(null);
      const result = await onConfirm();
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
        change(false);
      } else {
        setError(result.error);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={(o) => (pending ? undefined : change(o))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmPhrase ? (
          <div className="space-y-1.5">
            <label htmlFor={phraseId} className="text-sm">
              Type <span className="font-semibold">{confirmPhrase}</span> to confirm.
            </label>
            <Input id={phraseId} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={pending} autoComplete="off" spellCheck={false} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending || !matches}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
