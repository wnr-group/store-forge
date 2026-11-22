"use client";

import { QueryClient, QueryClientProvider, keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { checksFor, runDraftChecks, signatureOf, type DraftCheck } from "@/lib/themes/editor/draft-checks";
import type { PresentationSummary } from "./types";
import {
  applyThemeAction,
  getCurrentThemeAction,
  getThemeAction,
  getVersionsAction,
  checkDraftsAction,
  listPickerProductsAction,
  listPresentationsAction,
  listTemplatesAction,
  listThemesAction,
  publishPresentationAction,
  publishThemeAction,
  resetPresentationAction,
  rollbackAction,
} from "@/app/(dashboard)/dashboard/templates/actions";
import type { ActionResult } from "@/types/action";
import type { ThemeIndustry } from "./types";

/** A failed server action, carrying the safe message and the field errors the API produced. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** TanStack Query wants a promise that throws; server actions return `{ ok }`. This converts one into the other. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new ActionError(result.error, result.code, result.fieldErrors);
  return result.data as T;
}

export const themeKeys = {
  all: ["themes"] as const,
  list: (q: object) => ["themes", "list", q] as const,
  detail: (slug: string) => ["themes", "detail", slug] as const,
  current: ["themes", "current"] as const,
  templates: ["themes", "templates"] as const,
  versions: (id: string) => ["themes", "versions", id] as const,
  presentations: ["themes", "presentations"] as const,
  picker: (q: object) => ["themes", "picker", q] as const,
};

export function ThemeQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export type ThemeListQuery = { page: number; limit: number; search?: string; industry?: ThemeIndustry };

export const useThemeList = (q: ThemeListQuery) =>
  useQuery({ queryKey: themeKeys.list(q), queryFn: async () => unwrap(await listThemesAction(q)), placeholderData: keepPreviousData });

export const useThemeDetail = (slug: string | null) =>
  useQuery({ queryKey: themeKeys.detail(slug ?? ""), enabled: Boolean(slug), staleTime: 5 * 60_000, queryFn: async () => unwrap(await getThemeAction(slug)) });

export const useCurrentTheme = () => useQuery({ queryKey: themeKeys.current, queryFn: async () => unwrap(await getCurrentThemeAction()) });

export const useTemplates = () => useQuery({ queryKey: themeKeys.templates, queryFn: async () => unwrap(await listTemplatesAction()) });

export const useVersions = (templateId: string | null) =>
  useQuery({ queryKey: themeKeys.versions(templateId ?? ""), enabled: Boolean(templateId), queryFn: async () => unwrap(await getVersionsAction(templateId)) });

export function useApplyTheme() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => unwrap(await applyThemeAction(slug)),
    onSuccess: () => client.invalidateQueries({ queryKey: themeKeys.all }),
  });
}

export function usePublishTheme() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (label?: string) => unwrap(await publishThemeAction(label)),
    onSuccess: () => client.invalidateQueries({ queryKey: themeKeys.all }),
  });
}

export function useRollback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; versionId: string }) => unwrap(await rollbackAction(v)),
    onSuccess: () => client.invalidateQueries({ queryKey: themeKeys.all }),
  });
}

/** Every customized product with its state: the status chips of the picker and the "not published" summary. */
export const usePresentationList = () =>
  useQuery({ queryKey: themeKeys.presentations, retry: false, queryFn: async () => unwrap(await listPresentationsAction()) });

const NO_CHECKS: ReadonlyMap<string, DraftCheck> = new Map();

/**
 * Reads the never-published products of the list to tell empty drafts (nothing to publish) from real ones. Each row is read
 * once, in chunks, and remembered by (product, revision, updated-at), so the list changing or the editor re-rendering never
 * repeats a read. Rows that could not be read stay out of `checks` (unverified) and `failed` says so.
 */
export function useDraftChecks(rows: PresentationSummary[]) {
  const [cache] = useState(() => new Map<string, DraftCheck>());
  const query = useQuery({
    queryKey: [...themeKeys.presentations, "draft-checks", signatureOf(rows)] as const,
    enabled: rows.length > 0,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const outcome = await runDraftChecks(rows, cache, async (ids) => unwrap(await checkDraftsAction(ids)));
      return { checks: checksFor(rows, cache), ...outcome };
    },
  });
  return {
    checks: query.data?.checks ?? NO_CHECKS,
    checking: query.isFetching,
    failed: query.isError || (query.data?.failedChunks ?? 0) > 0,
    skipped: query.data?.skipped ?? 0,
    retry: () => void query.refetch(),
  };
}

export type PickerQuery = { page: number; search?: string };

/** The store's active products for the picker, from the existing admin product list. */
export const usePickerProducts = (q: PickerQuery, enabled = true) =>
  useQuery({ queryKey: themeKeys.picker(q), enabled, placeholderData: keepPreviousData, queryFn: async () => unwrap(await listPickerProductsAction(q)) });

export function usePublishPresentation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { productId: string; expectedRevision?: number }) => unwrap(await publishPresentationAction(v)),
    onSuccess: () => client.invalidateQueries({ queryKey: themeKeys.presentations }),
  });
}

export function useResetPresentation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => unwrap(await resetPresentationAction(productId)),
    onSuccess: () => client.invalidateQueries({ queryKey: themeKeys.presentations }),
  });
}
