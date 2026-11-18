"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import {
  applyTheme,
  getCurrentTheme,
  getPreview,
  getPreviewCollectionProducts,
  getPreviewProduct,
  getPreviewStoreData,
  getTemplate,
  getThemeDetail,
  getThemes,
  getVersions,
  listTemplates,
  publishTemplate,
  publishTheme,
  rollbackTemplate,
  saveDraft,
} from "@/services/theme.service";
import { THEME_INDUSTRIES } from "@/lib/themes/types";
import { invalidateStorefront } from "@/lib/storefront/cache";

/**
 * Server actions behind the Theme Store and the editor. The browser (TanStack Query) calls these; each one runs on the
 * server with the HttpOnly session, checks the member's permission, and forwards to the StoreForge API.
 */

const idSchema = z.string().uuid();
const slugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
/** Product and collection slugs as the storefront writes them in its links. */
const resourceSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const labelSchema = z.string().trim().max(80).optional();

const listSchema = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  limit: z.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(100).optional(),
  industry: z.enum(THEME_INDUSTRIES).optional(),
});

export const listThemesAction = async (input: unknown) => run(() => getThemes(parseInput(listSchema, input)));
export const getThemeAction = async (slug: unknown) => run(() => getThemeDetail(parseInput(slugSchema, slug)));
export const getCurrentThemeAction = async () => run(() => getCurrentTheme());

export async function applyThemeAction(slug: unknown) {
  return run(
    async () => {
      const result = await applyTheme(parseInput(slugSchema, slug));
      revalidatePath(ROUTES.templates);
      return result;
    },
    { operation: "theme.apply" },
  );
}

export const listTemplatesAction = async () => run(() => listTemplates());
export const getTemplateAction = async (id: unknown) => run(() => getTemplate(parseInput(idSchema, id)));
export const getPreviewAction = async (id: unknown) => run(() => getPreview(parseInput(idSchema, id)));
export const getPreviewStoreDataAction = async () => run(() => getPreviewStoreData());
export const getPreviewProductAction = async (slug: unknown) => run(() => getPreviewProduct(parseInput(resourceSlugSchema, slug)));
export const getPreviewCollectionProductsAction = async (slug: unknown) => run(() => getPreviewCollectionProducts(parseInput(resourceSlugSchema, slug)));

const saveSchema = z.object({
  id: idSchema,
  document: z.record(z.string(), z.unknown()),
  expectedRevision: z.number().int().min(1),
});

export async function saveDraftAction(input: unknown) {
  return run(async () => {
    const v = parseInput(saveSchema, input);
    return saveDraft(v.id, v.document, v.expectedRevision);
  });
}

export async function publishThemeAction(label?: unknown) {
  return run(
    async () => {
      const result = await publishTheme(parseInput(labelSchema, label));
      revalidatePath(ROUTES.templates);
      // The public storefront shows published work only; refresh it for this store.
      revalidatePath(`/s/${result.storeSlug}`, "layout");
      await invalidateStorefront();
      return result;
    },
    { operation: "theme.publish" },
  );
}

const publishOneSchema = z.object({ id: idSchema, expectedRevision: z.number().int().min(1).optional(), label: labelSchema });

export async function publishTemplateAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(publishOneSchema, input);
      const result = await publishTemplate(v.id, v.expectedRevision, v.label);
      revalidatePath(`/s/${result.storeSlug}`, "layout");
      await invalidateStorefront();
      return result;
    },
    { operation: "template.publish" },
  );
}

export const getVersionsAction = async (id: unknown) => run(() => getVersions(parseInput(idSchema, id)));

export async function rollbackAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(z.object({ id: idSchema, versionId: idSchema }), input);
      const result = await rollbackTemplate(v.id, v.versionId);
      revalidatePath(`/s/${result.storeSlug}`, "layout");
      await invalidateStorefront();
      return result;
    },
    { operation: "template.rollback" },
  );
}
