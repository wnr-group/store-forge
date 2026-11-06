import type { TemplateKey } from "./registry";
import { resolveTemplateKey } from "./resolve";
import type { SavedTemplateSettings } from "./types";

/** Pure form rules for the Templates page: no React, no browser APIs, so they can be unit-tested. */

export type TemplateFormValues = {
  templateKey: TemplateKey;
  accentColor: string;
  heroHeading: string;
  heroSubheading: string;
  heroImagePath: string | null;
};

export type NormalizedTemplateValues = {
  templateKey: TemplateKey;
  accentColor: string | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  heroImagePath: string | null;
};

const blank = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** What is saved right now. No row means the default template with nothing customized. */
export function baselineFrom(saved: SavedTemplateSettings | null): NormalizedTemplateValues {
  return {
    templateKey: resolveTemplateKey(saved?.templateKey),
    accentColor: blank(saved?.accentColor)?.toLowerCase() ?? null,
    heroHeading: blank(saved?.heroHeading),
    heroSubheading: blank(saved?.heroSubheading),
    heroImagePath: saved?.heroImagePath ?? null,
  };
}

export function formFrom(n: NormalizedTemplateValues): TemplateFormValues {
  return { templateKey: n.templateKey, accentColor: n.accentColor ?? "", heroHeading: n.heroHeading ?? "", heroSubheading: n.heroSubheading ?? "", heroImagePath: n.heroImagePath };
}

export function normalizeForm(v: TemplateFormValues): NormalizedTemplateValues {
  return {
    templateKey: v.templateKey,
    accentColor: blank(v.accentColor)?.toLowerCase() ?? null,
    heroHeading: blank(v.heroHeading),
    heroSubheading: blank(v.heroSubheading),
    heroImagePath: v.heroImagePath ?? null,
  };
}

/** Compared after normalizing, so whitespace or hex-case differences do not count as a change. */
export function isDirty(v: TemplateFormValues, baseline: NormalizedTemplateValues): boolean {
  return JSON.stringify(normalizeForm(v)) !== JSON.stringify(baseline);
}

export const canSave = (s: { canEdit: boolean; dirty: boolean; pending: boolean; uploading: boolean }) => s.canEdit && s.dirty && !s.pending && !s.uploading;
export const canCancel = (s: { dirty: boolean; pending: boolean; uploading: boolean }) => s.dirty && !s.pending && !s.uploading;

type SaveState = { current: TemplateFormValues; baseline: NormalizedTemplateValues };

/** Success moves the baseline to what was just saved; a failure changes nothing, so the user's edits are never lost. */
export function afterSave(state: SaveState, result: { ok: boolean }): SaveState {
  return result.ok ? { current: state.current, baseline: normalizeForm(state.current) } : state;
}

/** Unsaved form values in the shape the settings resolver takes (used by the live preview). */
export function toPreviewSaved(v: TemplateFormValues): SavedTemplateSettings {
  return { ...normalizeForm(v) };
}

/** Uploaded files not yet referenced by the database: these are discarded on Cancel. */
export function unsavedUploadPaths(items: Array<{ saved: boolean; status: string; path: string | null }>): string[] {
  return items.filter((i) => !i.saved && i.status === "done" && i.path).map((i) => i.path as string);
}
