"use client";

import { useCallback, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { FormState } from "@/components/shared/embedded-form";

/**
 * Asks before a dialog with typed work in it closes. Esc, a click outside, the close button and Cancel all come through
 * `requestClose`: with nothing changed it closes at once, with changes it asks first, and while a save is running it does not close
 * at all. A form reports its state with `report`; a finished save closes with `closeNow` (nothing is lost then, so no question).
 */
export function useDiscardGuard(onClose: () => void) {
  const state = useRef<FormState>({ dirty: false, pending: false });
  const [asking, setAsking] = useState(false);

  const report = useCallback((next: FormState) => {
    state.current = next;
  }, []);

  const closeNow = useCallback(() => {
    state.current = { dirty: false, pending: false };
    setAsking(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (state.current.pending) return;
    if (state.current.dirty) setAsking(true);
    else closeNow();
  }, [closeNow]);

  const confirm = (
    <AlertDialog open={asking} onOpenChange={setAsking}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>What you entered has not been saved. If you close now it is lost.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={closeNow}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { report, requestClose, closeNow, confirm };
}
