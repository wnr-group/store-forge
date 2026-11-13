"use client";

import { QueryClient, QueryClientProvider, keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  applyThemeAction,
  getCurrentThemeAction,
  getThemeAction,
  getVersionsAction,
  listTemplatesAction,
  listThemesAction,
  publishThemeAction,
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
