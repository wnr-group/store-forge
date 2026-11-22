import { describe, expect, it } from "vitest";
import { AUTOSAVE_MS, autosaveDelay, deriveSaveStatus, findNode, lookupOrder, mapDraftFieldErrors, STYLE_DEVICE } from "@/lib/themes/editor/shell-logic";

const n = (blocks: Record<string, unknown> = {}) => ({ type: "x", settings: {}, blocks, block_order: Object.keys(blocks) }) as never;

describe("save status", () => {
  it("conflict, saving and error win over everything else, in that order", () => {
    expect(deriveSaveStatus("conflict", true, 3)).toBe("conflict");
    expect(deriveSaveStatus("saving", true, 3)).toBe("saving");
    expect(deriveSaveStatus("error", true, 3)).toBe("error");
  });
  it("is invalid with local problems, unsaved with dirty drafts, saved otherwise", () => {
    expect(deriveSaveStatus("idle", true, 0)).toBe("invalid");
    expect(deriveSaveStatus("idle", false, 2)).toBe("unsaved");
    expect(deriveSaveStatus("idle", false, 0)).toBe("saved");
  });
});

describe("autosave pacing", () => {
  it("only schedules for unsaved and error", () => {
    for (const s of ["saved", "saving", "conflict", "invalid"] as const) expect(autosaveDelay(s, 0)).toBeNull();
    expect(autosaveDelay("unsaved", 0)).toBe(AUTOSAVE_MS);
    expect(AUTOSAVE_MS).toBe(1500);
  });
  it("retries a failed save with a doubling pause, then stops after three", () => {
    expect(autosaveDelay("error", 0)).toBe(4000);
    expect(autosaveDelay("error", 1)).toBe(8000);
    expect(autosaveDelay("error", 2)).toBe(16000);
    expect(autosaveDelay("error", 3)).toBeNull();
    // An unsaved edit after a failure is still saved at the normal pace.
    expect(autosaveDelay("unsaved", 5)).toBe(AUTOSAVE_MS);
  });
});

describe("server field errors", () => {
  it("strips the page kind prefix and keeps other keys", () => {
    expect(mapDraftFieldErrors("index", { "index.sections.a": "bad", "theme.x": "other", plain: "p" })).toEqual({ "sections.a": "bad", "theme.x": "other", plain: "p" });
  });
});

describe("shell helpers", () => {
  it("finds nested blocks", () => {
    const tree = n({ a: n({ b: n() }) });
    expect(findNode(tree, "b")).toBeDefined();
    expect(findNode(tree, "a")).toBeDefined();
    expect(findNode(tree, "zz")).toBeUndefined();
  });
  it("looks in the page being edited first", () => {
    expect(lookupOrder({ pageId: "b", docs: { a: {}, b: {}, c: {} } as never })).toEqual(["b", "a", "c"]);
  });
  it("writes style for the base breakpoint on desktop", () => {
    expect(STYLE_DEVICE).toEqual({ desktop: "base", tablet: "tablet", mobile: "mobile" });
  });
});
