import { useEffect } from "react";

/** What a form that can be shown inside a dialog tells the dialog: whether the merchant changed anything, and whether it is saving. */
export type FormState = { dirty: boolean; pending: boolean };

/**
 * Reports a form's state to the dialog around it (the theme editor), so the dialog can ask before it throws away typed work. The
 * report is cleared when the form goes away. `report` must be stable (a callback), and a form shown on its own page passes none.
 */
export function useReportFormState(report: ((state: FormState) => void) | undefined, dirty: boolean, pending: boolean) {
  useEffect(() => {
    report?.({ dirty, pending });
  }, [report, dirty, pending]);
  useEffect(
    () => () => {
      report?.({ dirty: false, pending: false });
    },
    [report],
  );
}
