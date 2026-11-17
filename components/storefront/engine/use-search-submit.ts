"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * Submits a storefront search form without a full page load. The form keeps its plain `action` (so it still works before
 * the page hydrates, or without JavaScript); once hydrated, the submit becomes a client-side navigation inside a
 * transition: the page stays on screen, `pending` is true until the results are ready, and no browser reload happens.
 */
export function useSearchSubmit(action: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    start(() => router.push(term ? `${action}?q=${encodeURIComponent(term)}` : action));
  };
  return { onSubmit, pending };
}
