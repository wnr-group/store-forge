"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/** The address a search goes to: `/search?q=term`, plus `&cat=<collection slug>` when a category is chosen. */
export function searchUrl(action: string, term: string, cat?: string | null): string {
  const params = new URLSearchParams();
  if (term.trim()) params.set("q", term.trim());
  if (cat && cat !== "all") params.set("cat", cat);
  const qs = params.toString();
  return qs ? `${action}?${qs}` : action;
}

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
    const data = new FormData(e.currentTarget);
    const url = searchUrl(action, String(data.get("q") ?? ""), String(data.get("cat") ?? ""));
    start(() => router.push(url));
  };
  return { onSubmit, pending };
}
