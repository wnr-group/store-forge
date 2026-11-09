import { describe, expect, it } from "vitest";
import { afterSave, baselineFrom, canCancel, canSave, formFrom, isDirty, normalizeForm, toPreviewSaved, unsavedUploadPaths, type TemplateFormValues } from "@/lib/templates/form-state";

const saved = { templateKey: "spotlight", accentColor: "#1a2b3c", heroHeading: "Hello", heroSubheading: "World", heroImagePath: "t1/store/h.webp" };
const form = (over: Partial<TemplateFormValues> = {}): TemplateFormValues => ({ ...formFrom(baselineFrom(saved)), ...over });

describe("baseline and normalization", () => {
  it("no saved row means the default template with nothing customized", () => {
    expect(baselineFrom(null)).toEqual({ templateKey: "classic", accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null });
  });
  it("an unknown saved key falls back to the default in the baseline", () => {
    expect(baselineFrom({ ...saved, templateKey: "removed" }).templateKey).toBe("classic");
  });
  it("normalizes whitespace, blanks and hex case", () => {
    expect(normalizeForm({ templateKey: "classic", accentColor: "  #ABCDEF ", heroHeading: "  ", heroSubheading: " hi ", heroImagePath: null })).toEqual({
      templateKey: "classic", accentColor: "#abcdef", heroHeading: null, heroSubheading: "hi", heroImagePath: null,
    });
  });
  it("formFrom turns nulls into empty strings for inputs", () => {
    expect(formFrom(baselineFrom(null))).toEqual({ templateKey: "classic", accentColor: "", heroHeading: "", heroSubheading: "", heroImagePath: null });
  });
});

describe("dirty state", () => {
  const base = baselineFrom(saved);
  it("is clean when the form equals the saved state", () => expect(isDirty(form(), base)).toBe(false));
  it("ignores differences that normalize away (whitespace, hex case)", () => {
    expect(isDirty(form({ accentColor: " #1A2B3C ", heroHeading: " Hello " }), base)).toBe(false);
  });
  it("is dirty when any field changes", () => {
    for (const change of [{ accentColor: "#000000" }, { heroHeading: "Other" }, { heroSubheading: "" }, { heroImagePath: null }, { heroImagePath: "t1/store/new.webp" }]) {
      expect(isDirty(form(change), base), JSON.stringify(change)).toBe(true);
    }
  });
  it("selecting another template is a change even if no field changed", () => {
    expect(isDirty(form({ templateKey: "classic" }), base)).toBe(true);
  });
  it("selecting the default when nothing is saved is not a change", () => {
    expect(isDirty(formFrom(baselineFrom(null)), baselineFrom(null))).toBe(false);
  });
});

describe("button rules", () => {
  it("Save needs permission, a change, and no save or upload in progress", () => {
    const ok = { canEdit: true, dirty: true, pending: false, uploading: false };
    expect(canSave(ok)).toBe(true);
    expect(canSave({ ...ok, canEdit: false })).toBe(false);
    expect(canSave({ ...ok, dirty: false })).toBe(false);
    expect(canSave({ ...ok, pending: true })).toBe(false);
    expect(canSave({ ...ok, uploading: true })).toBe(false);
  });
  it("Cancel needs a change and nothing in progress", () => {
    expect(canCancel({ dirty: true, pending: false, uploading: false })).toBe(true);
    expect(canCancel({ dirty: false, pending: false, uploading: false })).toBe(false);
    expect(canCancel({ dirty: true, pending: true, uploading: false })).toBe(false);
    expect(canCancel({ dirty: true, pending: false, uploading: true })).toBe(false);
  });
});

describe("cancel and failed save", () => {
  it("Cancel restores the saved values and selection", () => {
    const edited = form({ templateKey: "classic", heroHeading: "Edited", accentColor: "#ffffff" });
    expect(isDirty(edited, baselineFrom(saved))).toBe(true);
    const restored = formFrom(baselineFrom(saved));
    expect(restored).toEqual(form());
    expect(isDirty(restored, baselineFrom(saved))).toBe(false);
  });
  it("a failed save keeps every edit and the old baseline", () => {
    const edited = form({ heroHeading: "Edited" });
    const state = { current: edited, baseline: baselineFrom(saved) };
    expect(afterSave(state, { ok: false })).toEqual(state);
  });
  it("a successful save moves the baseline so the form is clean", () => {
    const edited = form({ templateKey: "classic", heroHeading: "Edited" });
    const next = afterSave({ current: edited, baseline: baselineFrom(saved) }, { ok: true });
    expect(isDirty(next.current, next.baseline)).toBe(false);
    expect(next.baseline.heroHeading).toBe("Edited");
  });
});

describe("preview values and unsaved uploads", () => {
  it("toPreviewSaved passes normalized values to the resolver", () => {
    expect(toPreviewSaved(form({ accentColor: " #ABCDEF ", heroHeading: "  " }))).toEqual({ templateKey: "spotlight", accentColor: "#abcdef", heroHeading: null, heroSubheading: "World", heroImagePath: "t1/store/h.webp" });
  });
  it("unsavedUploadPaths returns only finished, not-yet-saved uploads with a path", () => {
    expect(unsavedUploadPaths([
      { saved: true, status: "done", path: "a" }, { saved: false, status: "done", path: "b" },
      { saved: false, status: "uploading", path: "c" }, { saved: false, status: "error", path: null }, { saved: false, status: "done", path: null },
    ])).toEqual(["b"]);
  });
});
