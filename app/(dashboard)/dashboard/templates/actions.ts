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
import { getActiveStore } from "@/lib/tenant/context";
import {
  checkDrafts,
  getPresentation,
  listPickerProducts,
  listPresentations,
  loadProductPreview,
  publishPresentation,
  resetPresentation,
  savePresentationDraft,
} from "@/services/presentation.service";
import {
  createReusableSection,
  deleteReusableSection,
  discardDraft,
  getChangeLedger,
  getCurrentReview,
  getDraftChanges,
  getReadinessReport,
  getSpeedStats,
  getStudioSettings,
  getStudioStatus,
  listReusableSections,
  requestReview,
  updateReusableSection,
  updateStudioSettings,
} from "@/services/studio.service";

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

// ---- Per-product presentation (Customize > Product) ---------------------------------------------------------------

const productIdSchema = z.string().uuid();

/** Drops the cached public pages of this store, so a published or reset product design shows at once. Never fails the save. */
async function refreshStorefront() {
  try {
    const store = await getActiveStore();
    if (store?.slug) revalidatePath(`/s/${store.slug}`, "layout");
  } catch {
    // The cached copy expires on its own.
  }
  await invalidateStorefront();
}

/** Whether Studio is on for this store. Never fails: any error reads as off. */
export const getStudioStatusAction = async () => run(() => getStudioStatus());

export const listPresentationsAction = async () => run(() => listPresentations());

/** Sorts never-published products into empty drafts (nothing to publish) and real ones; unreadable ones are in neither. */
export const checkDraftsAction = async (ids: unknown) => run(() => checkDrafts(parseInput(z.array(z.string().uuid()).max(50), ids)));
export const getPresentationAction = async (productId: unknown) => run(() => getPresentation(parseInput(productIdSchema, productId)));

const pickerSchema = z.object({ page: z.number().int().min(1).max(10_000).default(1), search: z.string().trim().max(100).optional() });
export const listPickerProductsAction = async (input: unknown) => run(() => listPickerProducts(parseInput(pickerSchema, input)));

const previewTargetSchema = z
  .object({ productId: productIdSchema.optional(), slug: z.string().trim().min(1).max(200).optional() })
  .refine((v) => Boolean(v.productId) !== Boolean(v.slug), { message: "Choose one product." });
export const loadProductPreviewAction = async (input: unknown) => run(() => loadProductPreview(parseInput(previewTargetSchema, input)));

const savePresentationSchema = z.object({
  productId: productIdSchema,
  document: z.record(z.string(), z.unknown()),
  expectedRevision: z.number().int().min(0),
});

/** Saves a draft only: shoppers keep seeing the published settings, so there is nothing to invalidate. */
export async function savePresentationDraftAction(input: unknown) {
  return run(async () => {
    const v = parseInput(savePresentationSchema, input);
    return savePresentationDraft(v.productId, v.document, v.expectedRevision);
  });
}

const publishPresentationSchema = z.object({ productId: productIdSchema, expectedRevision: z.number().int().min(1).optional() });

export async function publishPresentationAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(publishPresentationSchema, input);
      const result = await publishPresentation(v.productId, v.expectedRevision);
      await refreshStorefront();
      return result;
    },
    { operation: "product-presentation.publish" },
  );
}

/** The API removes draft and live settings at once, so the storefront changes immediately and its cache must be dropped. */
export async function resetPresentationAction(productId: unknown) {
  return run(
    async () => {
      const result = await resetPresentation(parseInput(productIdSchema, productId));
      await refreshStorefront();
      return result;
    },
    { operation: "product-presentation.reset" },
  );
}

export const getReadinessReportAction = async (templateId?: unknown) =>
  run(() => getReadinessReport(templateId ? parseInput(idSchema, templateId) : undefined));

export const getStudioSettingsAction = async () => run(() => getStudioSettings());

export const updateStudioSettingsAction = async (input: unknown) =>
  run(() =>
    updateStudioSettings(
      parseInput(
        z.object({
          reviewDisclosureText: z.string().trim().min(1).max(500).optional(),
          reviewDisclosureLanguage: z
            .string()
            .trim()
            .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
            .optional(),
        }),
        input,
      ),
    ),
  );

export const getSpeedStatsAction = async () => run(() => getSpeedStats());

export const requestReviewAction = async () => run(() => requestReview());

export const getCurrentReviewAction = async () => run(() => getCurrentReview());

export const getDraftChangesAction = async () => run(() => getDraftChanges());

export const getChangeLedgerAction = async (templateId?: unknown) =>
  run(() => getChangeLedger(templateId ? parseInput(idSchema, templateId) : undefined));

export const discardDraftAction = async (input: unknown) =>
  run(async () => {
    const v = parseInput(z.object({ templateId: idSchema, reason: z.string().trim().min(1).max(500) }), input);
    const result = await discardDraft(v.templateId, v.reason);
    revalidatePath(ROUTES.templates);
    return result;
  });

export const listReusableSectionsAction = async () => run(() => listReusableSections());

export const createReusableSectionAction = async (input: unknown) =>
  run(() =>
    createReusableSection(
      parseInput(
        z.object({
          componentId: z.string().min(1).max(64),
          name: z.string().min(1).max(100),
          description: z.string().max(300).optional(),
          content: z.record(z.string(), z.unknown()),
        }),
        input,
      ),
    ),
  );

export const updateReusableSectionAction = async (input: unknown) =>
  run(() => {
    const v = parseInput(
      z.object({
        id: idSchema,
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(300).optional(),
        content: z.record(z.string(), z.unknown()).optional(),
      }),
      input,
    );
    return updateReusableSection(v.id, { name: v.name, description: v.description, content: v.content });
  });

export const deleteReusableSectionAction = async (id: unknown) =>
  run(() => deleteReusableSection(parseInput(idSchema, id)));

