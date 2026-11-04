"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/types/action";

const SUMMARY = "Please correct the highlighted fields.";

/** Flattens Zod issues to { "variants.0.sku": "message" }, keeping the first message per field. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}

/** Moves keyboard focus (and the viewport) to the first control marked aria-invalid. Runs after React commits the errors. */
export function focusFirstInvalid(root: ParentNode = document) {
  requestAnimationFrame(() => {
    const el = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  });
}

/**
 * Shared form behaviour for the dashboard:
 *  - validate everything on submit with the SAME Zod schema the server uses, focus the first invalid field;
 *  - validate a single field on blur (never before the user has touched it);
 *  - clear a field's error as soon as the user edits it;
 *  - merge server-side field errors, redirect to sign-in when the session has expired;
 *  - one in-flight submission at a time (a double-click cannot send twice).
 */
export function useFormErrors() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setErrors({});
    setFormError(null);
  }, []);

  /** Full-form validation. Returns false (and surfaces every error) when invalid. */
  const validate = useCallback(<S extends z.ZodType>(schema: S, payload: unknown): boolean => {
    const parsed = schema.safeParse(payload);
    if (parsed.success) {
      setErrors({});
      setFormError(null);
      return true;
    }
    setErrors(fieldErrorsOf(parsed.error));
    setFormError(SUMMARY);
    focusFirstInvalid();
    return false;
  }, []);

  /** Blur validation for one field: shows or clears only that field's message. */
  const validateField = useCallback(<S extends z.ZodType>(schema: S, payload: unknown, name: string) => {
    const parsed = schema.safeParse(payload);
    const message = parsed.success ? undefined : fieldErrorsOf(parsed.error)[name];
    setErrors((cur) => {
      if (!message && !(name in cur)) return cur;
      const next = { ...cur };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }, []);

  /** Call from onChange: the message disappears as soon as the user starts fixing the field. */
  const clear = useCallback((name: string) => {
    setErrors((cur) => {
      if (!(name in cur)) return cur;
      const next = { ...cur };
      delete next[name];
      return next;
    });
  }, []);

  /** Applies a failed ActionResult. Returns true when it was handled by redirecting to sign-in. */
  const fail = useCallback((result: Extract<ActionResult<unknown>, { ok: false }>) => {
    if (result.code === "UNAUTHENTICATED") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`${ROUTES.login}?next=${next}`);
      return true;
    }
    setErrors(result.fieldErrors ?? {});
    setFormError(result.error);
    focusFirstInvalid();
    return false;
  }, [router]);

  /** Runs `task` as the single in-flight submission. Input is never cleared on failure. */
  const submit = useCallback((task: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        await task();
      } catch {
        setFormError("Something went wrong. Please check your connection and try again.");
      } finally {
        inFlight.current = false;
      }
    });
  }, []);

  return { errors, formError, setFormError, pending, validate, validateField, clear, fail, reset, submit };
}
