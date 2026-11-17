import { describe, expect, it } from "vitest";
import {
  availableItems, createPresentationStore, dirtyEntries, discardChanges, entryFromDetail, isEntryDirty, isWaitingToPublish, markEntrySaved, previewPresentation, putEntry,
  replaceEntry, setBlockHidden, setFocalPoint, setGalleryLayout, setMediaPosition,
} from "@/lib/themes/editor/presentation-state";
import type { PresentationDetail } from "@/lib/themes/types";

const detail = (productId: string, over: Partial<PresentationDetail> = {}): PresentationDetail => ({
  productId, revision: 0, publicationState: "default", document: { schemaVersion: 1 }, publishedDocument: null, publishedAt: null, updatedAt: null, ...over,
});
const store = () => {
  let s = createPresentationStore();
  s = putEntry(s, entryFromDetail(detail("a"), { name: "Product A", slug: "a" }));
  s = putEntry(s, entryFromDetail(detail("b", { revision: 3, publicationState: "published", document: { schemaVersion: 1, gallery: { layout: "stacked" } }, publishedDocument: { schemaVersion: 1, gallery: { layout: "stacked" } } }), { name: "Product B", slug: "b" }));
  s = putEntry(s, entryFromDetail(detail("c"), { name: "Product C", slug: "c" }));
  return s;
};
const doc = (s: ReturnType<typeof store>, id: string) => s.entries[id].document;

describe("product presentation state", () => {
  it("a product with no customization starts clean with the default document at revision 0", () => {
    const e = store().entries.a;
    expect(e.revision).toBe(0);
    expect(e.document).toEqual({ schemaVersion: 1 });
    expect(isEntryDirty(e)).toBe(false);
    expect(isWaitingToPublish(e)).toBe(false);
  });

  it("each setting changes the draft and makes the entry dirty; reverting to the stored value is clean again", () => {
    let s = setGalleryLayout(store(), "a", "stacked");
    expect(doc(s, "a")).toEqual({ schemaVersion: 1, gallery: { layout: "stacked" } });
    expect(isEntryDirty(s.entries.a)).toBe(true);
    s = setGalleryLayout(s, "a", undefined);
    expect(doc(s, "a")).toEqual({ schemaVersion: 1 });
    expect(isEntryDirty(s.entries.a)).toBe(false);
  });

  it("media position, focal point (clamped and rounded) and hidden blocks (catalogue order, no duplicates)", () => {
    let s = setMediaPosition(store(), "a", "right");
    s = setFocalPoint(s, "a", { x: 140.6, y: -5 });
    s = setBlockHidden(s, "a", "social-share", true);
    s = setBlockHidden(s, "a", "product-sku", true);
    s = setBlockHidden(s, "a", "product-sku", true);
    expect(doc(s, "a")).toEqual({ schemaVersion: 1, gallery: { mediaPosition: "right" }, focalPoint: { x: 100, y: 0 }, hiddenBlocks: ["product-sku", "social-share"] });
    s = setBlockHidden(s, "a", "product-sku", false);
    s = setBlockHidden(s, "a", "social-share", false);
    s = setFocalPoint(s, "a", undefined);
    s = setMediaPosition(s, "a", undefined);
    expect(doc(s, "a")).toEqual({ schemaVersion: 1 });
    expect(dirtyEntries(s)).toHaveLength(0);
  });

  it("changing one product never touches another (isolation)", () => {
    const before = store();
    const after = setBlockHidden(setFocalPoint(setGalleryLayout(before, "a", "stacked"), "a", { x: 1, y: 2 }), "a", "related-products", true);
    expect(after.entries.b).toBe(before.entries.b);
    expect(after.entries.c).toBe(before.entries.c);
    expect(dirtyEntries(after).map((e) => e.productId)).toEqual(["a"]);
    // the input state is never mutated
    expect(doc(before, "a")).toEqual({ schemaVersion: 1 });
  });

  it("an edit for an unknown product, or a no-op edit, returns the same state", () => {
    const s = store();
    expect(setGalleryLayout(s, "zzz", "stacked")).toBe(s);
    expect(setGalleryLayout(s, "b", "stacked")).toBe(s);
  });

  it("a stored draft compares by meaning, not by key order", () => {
    const e = entryFromDetail(detail("x", { revision: 1, publicationState: "draft", document: { hiddenBlocks: ["social-share", "product-sku"], schemaVersion: 1 } }), { name: "X", slug: "x" });
    expect(isEntryDirty(e)).toBe(false);
    expect(isWaitingToPublish(e)).toBe(true);
  });

  it("markEntrySaved moves the baseline and revision; edits made while saving stay dirty", () => {
    let s = setGalleryLayout(store(), "a", "stacked");
    const key = JSON.stringify(doc(s, "a"));
    s = setMediaPosition(s, "a", "right"); // typed while the save was in flight
    s = markEntrySaved(s, detail("a", { revision: 1, publicationState: "draft", document: { schemaVersion: 1, gallery: { layout: "stacked" } } }), key);
    expect(s.entries.a.revision).toBe(1);
    expect(s.entries.a.publicationState).toBe("draft");
    expect(doc(s, "a")).toEqual({ schemaVersion: 1, gallery: { layout: "stacked", mediaPosition: "right" } });
    expect(isEntryDirty(s.entries.a)).toBe(true);
  });

  it("markEntrySaved with nothing typed since leaves the entry clean", () => {
    let s = setGalleryLayout(store(), "a", "stacked");
    const key = JSON.stringify(doc(s, "a"));
    s = markEntrySaved(s, detail("a", { revision: 1, publicationState: "draft", document: { schemaVersion: 1, gallery: { layout: "stacked" } } }), key);
    expect(isEntryDirty(s.entries.a)).toBe(false);
  });

  it("replaceEntry takes the server's copy (conflict reload, publish, reset) and drops local edits", () => {
    let s = setGalleryLayout(store(), "b", "thumbnails");
    s = replaceEntry(s, detail("b", { revision: 7, publicationState: "published_with_changes", document: { schemaVersion: 1, focalPoint: { x: 5, y: 6 } }, publishedDocument: { schemaVersion: 1 } }));
    expect(s.entries.b.revision).toBe(7);
    expect(doc(s, "b")).toEqual({ schemaVersion: 1, focalPoint: { x: 5, y: 6 } });
    expect(isEntryDirty(s.entries.b)).toBe(false);
    expect(s.entries.b.name).toBe("Product B");
    // a server reset returns the default detail
    s = replaceEntry(s, detail("b"));
    expect(s.entries.b.revision).toBe(0);
    expect(s.entries.b.publicationState).toBe("default");
    expect(doc(s, "b")).toEqual({ schemaVersion: 1 });
  });

  it("discardChanges goes back to the stored draft", () => {
    const s = discardChanges(setGalleryLayout(store(), "b", "thumbnails"), "b");
    expect(doc(s, "b")).toEqual({ schemaVersion: 1, gallery: { layout: "stacked" } });
    expect(isEntryDirty(s.entries.b)).toBe(false);
  });

  it("the preview shows the draft being edited; a product not loaded falls back to its published settings, or nothing", () => {
    const s = setGalleryLayout(store(), "a", "stacked");
    expect(previewPresentation(s, "a", null)?.gallery?.layout).toBe("stacked");
    expect(previewPresentation(s, "zzz", { schemaVersion: 1, focalPoint: { x: 9, y: 9 } })?.focalPoint).toEqual({ x: 9, y: 9 });
    expect(previewPresentation(s, null, null)).toBeNull();
    expect(previewPresentation(s, "zzz", "junk")).toEqual({ schemaVersion: 1 });
  });
});

describe("availableItems: which of the six the page template can show", () => {
  it("reads the main-product blocks and the related-products section", () => {
    const page = {
      sections: {
        main: { type: "main-product", blocks: { t: { type: "product-title" }, s: { type: "product-sku" }, d: { type: "product-description" }, h: { type: "social-share" } } },
        rel: { type: "related-products", blocks: {} },
        other: { type: "rich-text", blocks: { x: { type: "product-category" } } },
      },
    };
    expect(availableItems(page)).toEqual({ "product-description": true, "product-sku": true, "product-type": false, "product-category": false, "social-share": true, "related-products": true });
  });
  it("is all false for an empty or odd document", () => {
    expect(Object.values(availableItems(null)).every((v) => v === false)).toBe(true);
    expect(Object.values(availableItems({ sections: { a: null } })).every((v) => v === false)).toBe(true);
  });
});

import { mergeLoadedProduct, problemsFromFieldErrors, publishedMessage, summarizeWaiting } from "@/lib/themes/editor/presentation-state";

describe("switching between products", () => {
  const loaded = (id: string, over: Partial<PresentationDetail> = {}) => ({ productId: id, name: `P ${id}`, slug: id, presentation: detail(id, over) });

  it("a product loaded for the first time gets an entry from the server's copy", () => {
    const s = mergeLoadedProduct(createPresentationStore(), loaded("a", { revision: 2, publicationState: "draft", document: { schemaVersion: 1, focalPoint: { x: 1, y: 2 } } }));
    expect(s.entries.a.revision).toBe(2);
    expect(s.entries.a.document.focalPoint).toEqual({ x: 1, y: 2 });
  });

  it("a product with unsaved edits is kept exactly as it is when it is picked again", () => {
    const edited = setGalleryLayout(mergeLoadedProduct(createPresentationStore(), loaded("a")), "a", "stacked");
    const again = mergeLoadedProduct(edited, loaded("a", { revision: 9 }));
    expect(again).toBe(edited);
    expect(again.entries.a.document.gallery?.layout).toBe("stacked");
  });

  it("a clean product is refreshed from the server, and other products are never touched", () => {
    let s = mergeLoadedProduct(createPresentationStore(), loaded("a"));
    s = mergeLoadedProduct(s, loaded("b"));
    const before = s.entries.b;
    s = mergeLoadedProduct(s, loaded("a", { revision: 4, publicationState: "published" }));
    expect(s.entries.a.revision).toBe(4);
    expect(s.entries.b).toBe(before);
  });

  it("when the settings could not be read the store is unchanged (the preview still works)", () => {
    const s = createPresentationStore();
    expect(mergeLoadedProduct(s, { productId: "a", name: "A", slug: "a", presentation: null })).toBe(s);
  });
});

describe("saving and publishing helpers", () => {
  it("maps the API's field names to paths inside the document", () => {
    expect(problemsFromFieldErrors("p1", { "productPresentation.p1.gallery.layout": "Layout must be one of: thumbnails, stacked.", "productPresentation.p1": "bad", other: "x" })).toEqual({
      "gallery.layout": "Layout must be one of: thumbnails, stacked.",
      "": "bad",
      other: "x",
    });
  });

  it("waiting products: the API's list, corrected by what is loaded locally", () => {
    let s = createPresentationStore();
    s = putEntry(s, entryFromDetail(detail("loaded-clean", { revision: 1, publicationState: "published", document: { schemaVersion: 1 }, publishedDocument: { schemaVersion: 1 } }), { name: "L", slug: "l" }));
    s = putEntry(s, entryFromDetail(detail("loaded-draft", { revision: 1, publicationState: "draft", document: { schemaVersion: 1, hiddenBlocks: ["social-share"] } }), { name: "D", slug: "d" }));
    s = setGalleryLayout(putEntry(s, entryFromDetail(detail("typing"), { name: "T", slug: "t" })), "typing", "stacked");
    const list = [
      { productId: "listed-draft", publicationState: "draft" as const },
      { productId: "listed-live", publicationState: "published" as const },
      { productId: "loaded-clean", publicationState: "published_with_changes" as const }, // stale: the loaded copy says it is live
    ];
    const checks = new Map([["listed-draft", "real" as const]]);
    expect([...summarizeWaiting(list, s, checks).waiting].sort()).toEqual(["listed-draft", "loaded-draft", "typing"]);
  });

  it("the publish-all message names pages and products from the API's counts", () => {
    expect(publishedMessage(2, 1)).toBe("Published 2 pages and 1 product");
    expect(publishedMessage(1, 0)).toBe("Published 1 page");
    expect(publishedMessage(0, 3)).toBe("Published 3 products");
    expect(publishedMessage(0, 0)).toBe("Your store is already up to date");
  });
});
