"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActionResult } from "@/types/action";

type Variant = React.ComponentProps<typeof Button>["variant"];

/** Runs a server action, shows its error as a toast, refreshes the page data on success. Used for one-click buttons. */
export function useServerAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult<unknown>>, success?: string, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

/** A button that runs one server action (no form), with a pending state. */
export function ActionButton({ action, success, children, variant = "outline", size = "sm", disabled, confirm }: { action: () => Promise<ActionResult<unknown>>; success?: string; children: React.ReactNode; variant?: Variant; size?: React.ComponentProps<typeof Button>["size"]; disabled?: boolean; confirm?: string }) {
  const { pending, run } = useServerAction();
  return (
    <Button type="button" variant={variant} size={size} disabled={pending || disabled} onClick={() => (confirm && !window.confirm(confirm) ? undefined : run(action, success))}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

/**
 * A dialog around a small form. `onSubmit` returns the server action result: an error stays in the dialog (field messages are
 * passed to `onFieldErrors`), success closes it, shows `success` and refreshes the page. Remount (key) to reset the fields.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pendingLabel = "Saving…",
  destructive,
  success,
  onSubmit,
  onDone,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  success?: string;
  onSubmit: () => Promise<ActionResult<unknown>> | ActionResult<unknown>;
  onDone?: (data: unknown) => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await onSubmit();
      if (!result.ok) {
        const fields = result.fieldErrors ? Object.values(result.fieldErrors).filter(Boolean) : [];
        setError(fields.length ? `${result.error} ${fields.join(" ")}` : result.error);
        return;
      }
      if (success) toast.success(success);
      onOpenChange(false);
      onDone?.(result.data);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className={wide ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
