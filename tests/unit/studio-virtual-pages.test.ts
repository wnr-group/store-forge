import { describe, expect, it } from "vitest";
import { readStyle } from "@/lib/editor/style";
import { readTextOverrides } from "@/lib/editor/text";
import { defaultPageDocument, PAGE_KEYS, storedPageDocument, type PageKey } from "@/lib/storefront/pages";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import { createState, setElementStyle, setTextOverride } from "@/lib/themes/editor/state";
import { foldVirtualPages, hasStoredPage, openVirtualPage, resetVirtualPage, virtualId } from "@/lib/themes/editor/virtual";

const registry = getRegistry();
const themeState = () => createState("theme", [{ templateId: "theme", kind: "theme_settings", name: "Theme", revision: 1, document: { settings: {} } }]);
const ok = (d: unknown) => validateDocument("index", d as never, registry, {}).ok;

function edit(state: ReturnType<typeof themeState>, key: PageKey) {
  const first = defaultPageDocument(key).order[0];
  let s = openVirtualPage(state, "theme", key);
  for (const d of ["mobile", "tablet"] as const) s = setElementStyle(s, virtualId(key), first, undefined, d, "hidden", true);
  s = setTextOverride(s, virtualId(key), first, "Original words", `Edited ${key}`);
  return { state: foldVirtualPages(s, "theme"), first };
}

describe("the eight virtual pages", () => {
  it("are exactly products, collections, search, cart, wishlist, content, about, contact", () => {
    expect([...PAGE_KEYS]).toEqual(["products", "collections", "search", "cart", "wishlist", "content", "about", "contact"]);
  });

  // Regression for D-002: generated rich-text pages used backgroundColor "transparent", which the shared colour rule rejects.
  it.each(PAGE_KEYS)("%s: the default validates; edits persist into settings.pages and still validate; reset restores the default", (key) => {
    expect(ok(defaultPageDocument(key))).toBe(true);
    const { state, first } = edit(themeState(), key);
    const stored = storedPageDocument(state.docs.theme.document, key)!;
    expect(stored).not.toBeNull();
    expect(readStyle(stored.sections[first].settings).mobile?.hidden).toBe(true);
    expect(readStyle(stored.sections[first].settings).tablet?.hidden).toBe(true);
    expect(readTextOverrides(stored.sections[first].settings)).toContainEqual({ from: "Original words", to: `Edited ${key}` });
    expect(ok(stored)).toBe(true);
    expect(hasStoredPage(state, "theme", key)).toBe(true);

    const reset = resetVirtualPage(state, "theme", key);
    expect(hasStoredPage(reset, "theme", key)).toBe(false);
    expect(reset.docs[virtualId(key)].document).toEqual(defaultPageDocument(key));
  });

  it("resetting one page leaves every other edited page exactly as it was", () => {
    let s = themeState();
    for (const key of PAGE_KEYS) s = edit(s, key).state;
    const before = Object.fromEntries(PAGE_KEYS.map((k) => [k, structuredClone(storedPageDocument(s.docs.theme.document, k))]));
    const after = resetVirtualPage(s, "theme", "cart");
    for (const key of PAGE_KEYS.filter((k) => k !== "cart")) expect(storedPageDocument(after.docs.theme.document, key), key).toEqual(before[key]);
    expect(storedPageDocument(after.docs.theme.document, "cart")).toBeNull();
  });
});

describe("generated pages on the theme background (D-002)", () => {
  const dark = { settings: { colors: { background: "#101010" } } };
  it("keeps the generated default valid and shows the theme background on the generated band", async () => {
    const { withPageBackground } = await import("@/lib/storefront/documents");
    const doc = withPageBackground(defaultPageDocument("products"), dark);
    expect(JSON.stringify(doc)).toContain("#101010");
    expect(ok(doc)).toBe(true);
    expect(ok(withPageBackground(defaultPageDocument("about"), null))).toBe(true);
  });
});
