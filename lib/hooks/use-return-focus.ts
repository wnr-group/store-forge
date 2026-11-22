"use client";

import { useCallback, useEffect, useRef } from "react";

const IN_DIALOG = '[role="dialog"], [role="alertdialog"]';

/**
 * Gives a controlled dialog its focus back. A dialog opened from a plain button (state, no Dialog trigger) otherwise
 * leaves keyboard focus on the page body when it closes, so the user has to tab from the top again.
 *
 * Call it in the component that owns the `open` state and pass the result to <DialogContent finalFocus={...}>:
 *   const finalFocus = useReturnFocus(draft !== null);
 *
 * - It tracks the last control that was focused or pressed OUTSIDE any dialog. Focus is trapped inside a dialog while it
 *   is open, so at close time that control is the one that opened it (a pointer press is tracked too, for browsers that
 *   do not focus a button on click).
 * - base-ui hands focus back to it on close (finalFocus).
 * - Dialogs that are unmounted the moment they close skip base-ui's hand-back, so if focus has fallen to the page body
 *   it is restored here. Focus that has been moved somewhere on purpose is never overridden.
 */
export function useReturnFocus(open: boolean) {
  const last = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const track = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const el = e.type === "pointerdown" ? t.closest<HTMLElement>('button, a[href], [role="button"]') : t;
      if (el && el !== document.body && !el.closest(IN_DIALOG)) last.current = el;
    };
    // Focus can already be on the opener before this component hydrates (the page content hydrates after the layout).
    const current = document.activeElement;
    if (current instanceof HTMLElement && current !== document.body && !current.closest(IN_DIALOG)) last.current = current;
    document.addEventListener("focusin", track, true);
    document.addEventListener("pointerdown", track, true);
    return () => {
      document.removeEventListener("focusin", track, true);
      document.removeEventListener("pointerdown", track, true);
    };
  }, []);

  useEffect(() => {
    if (wasOpen.current && !open) {
      const el = last.current;
      if (el?.isConnected) {
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || active === document.body) el.focus();
        }, 0);
      }
    }
    wasOpen.current = open;
  }, [open]);

  /** For `finalFocus`: the opener while it still exists, otherwise base-ui's default behaviour. */
  return useCallback(() => (last.current?.isConnected ? last.current : true), []);
}
