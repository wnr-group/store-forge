import { describe, expect, it } from "vitest";
import { presentationKey } from "@/lib/templates/product-presentation";
import { advanceHistory, canUndo, changedBetween, emptyHistory, mergeRestored, recordChange, snapshotOf, undo } from "@/lib/themes/editor/history";
import {
  createPresentationStore, dirtyEntries, discardChanges, entryFromDetail, hasPendingPublish, isEntryDirty, isWaitingToPublish, markEntrySaved, mergeLoadedProduct, productActions, putEntry,
  replaceEntry, restoreDrafts, serverChangesEntry, setBlockHidden, setFocalPoint, setGalleryLayout, setMediaPosition, splitProductFieldErrors, summarizeWaiting, unsupportedVersionOf,
} from "@/lib/themes/editor/presentation-state";
import type { PresentationDetail } from "@/lib/themes/types";

/** Safety rules of the product editor: undo vs the server's copy, empty drafts, unsupported versions, switching, publish errors. */

const detail = (productId: string, over: Partial<PresentationDetail> = {}): PresentationDetail => ({
  productId, revision: 0, publicationState: "default", document: { schemaVersion: 1 }, publishedDocument: null, publishedAt: null, updatedAt: null, ...over,
});
const meta = { name: "Product", slug: "p" };
const X = { schemaVersion: 1, gallery: { layout: "stacked" } };
const Y = { schemaVersion: 1, hiddenBlocks: ["social-share"] };

describe("undo never brings older server content back (regression)", () => {
  it("a server replacement followed by Undo does not restore the older content", () => {
    // Loaded clean at revision 3.
    let s = putEntry(createPresentationStore(), entryFromDetail(detail("a", { revision: 3, publicationState: "published", document: X, publishedDocument: X }), meta));
    // A local edit is recorded as an undo step, and autosave stores it as revision 4.
    const beforeEdit = snapshotOf({}, s.entries);
    s = setFocalPoint(s, "a", { x: 10, y: 20 });
    const history = recordChange(emptyHistory(), beforeEdit, 0);
    const withFocal = { schemaVersion: 1, gallery: { layout: "stacked" }, focalPoint: { x: 10, y: 20 } };
    s = markEntrySaved(s, detail("a", { revision: 4, publicationState: "published_with_changes", document: withFocal, publishedDocument: X }), presentationKey(withFocal));
    expect(isEntryDirty(s.entries.a)).toBe(false);

    // Someone else saves revision 5 with different content; picking the product again takes the server's copy.
    const beforeReplace = snapshotOf({}, s.entries);
    s = mergeLoadedProduct(s, { productId: "a", ...meta, presentation: detail("a", { revision: 5, publicationState: "published_with_changes", document: Y, publishedDocument: X }) });
    expect(s.entries.a.revision).toBe(5);
    expect(s.entries.a.document).toEqual(Y);
    expect(s.entries.a.epoch).toBe(1);
    const afterReplace = snapshotOf({}, s.entries);
    // taking the server's copy is not an edit, so it makes no undo step
    expect(changedBetween(beforeReplace, afterReplace)).toBe(false);

    // The earlier local edit can no longer be undone: the history, advanced by the same commit, no longer offers it.
    const pruned = advanceHistory(history, beforeReplace, afterReplace, 20_000);
    expect(canUndo(pruned)).toBe(false);
    // and even the unpruned history cannot write it: undo drops the step instead of applying it
    const step = undo(history, afterReplace);
    expect(step.snapshot).toBeNull();
    expect(canUndo(step.history)).toBe(false);
    const restored = restoreDrafts(s, snapshotOf({}, putEntry(createPresentationStore(), entryFromDetail(detail("a", { revision: 3, document: withFocal }), meta)).entries).pres);
    expect(restored).toBe(s);
    expect(restored.entries.a.document).toEqual(Y);
    expect(restored.entries.a.revision).toBe(5);
    expect(dirtyEntries(restored)).toHaveLength(0); // nothing for autosave to send
    // and the baseline the editor expects afterwards is the replaced content, not the old one
    expect(mergeRestored(afterReplace, history.past[0]).pres.a.key).toBe(afterReplace.pres.a.key);
  });

  it("the same holds after a conflict reload or a reset (replaceEntry)", () => {
    let s = putEntry(createPresentationStore(), entryFromDetail(detail("a", { revision: 2, document: X, publicationState: "draft" }), meta));
    const old = snapshotOf({}, s.entries);
    s = replaceEntry(s, detail("a", { revision: 6, document: Y, publicationState: "draft" }));
    expect(s.entries.a.epoch).toBe(1);
    expect(restoreDrafts(s, old.pres)).toBe(s);
    s = replaceEntry(s, detail("a")); // reset
    expect(s.entries.a.epoch).toBe(2);
    expect(restoreDrafts(s, old.pres)).toBe(s);
  });

  it("a replacement that changes nothing keeps the epoch, so undo of local edits still works after a publish", () => {
    let s = putEntry(createPresentationStore(), entryFromDetail(detail("a", { revision: 3, publicationState: "published", document: X, publishedDocument: X }), meta));
    const beforeEdit = snapshotOf({}, s.entries);
    s = setMediaPosition(s, "a", "right");
    const history = recordChange(emptyHistory(), beforeEdit, 0);
    const saved = { schemaVersion: 1, gallery: { layout: "stacked", mediaPosition: "right" } };
    s = markEntrySaved(s, detail("a", { revision: 4, publicationState: "published_with_changes", document: saved, publishedDocument: X }), presentationKey(saved));
    // publish: same revision and content, only the state and live copy move
    s = replaceEntry(s, detail("a", { revision: 4, publicationState: "published", document: saved, publishedDocument: saved }));
    expect(s.entries.a.epoch).toBe(0);
    const step = undo(history, snapshotOf({}, s.entries));
    const restored = restoreDrafts(s, step.snapshot!.pres);
    expect(restored.entries.a.document).toEqual(X); // normal undo works
    expect(isEntryDirty(restored.entries.a)).toBe(true); // an unsaved edit again, saved against the revision it really holds
    expect(restored.entries.a.revision).toBe(4);
  });

  it("normal undo of a local edit is unaffected", () => {
    let s = putEntry(createPresentationStore(), entryFromDetail(detail("a"), meta));
    const before = snapshotOf({}, s.entries);
    s = setBlockHidden(s, "a", "product-sku", true);
    const history = recordChange(emptyHistory(), before, 0);
    const step = undo(history, snapshotOf({}, s.entries));
    expect(restoreDrafts(s, step.snapshot!.pres).entries.a.document).toEqual({ schemaVersion: 1 });
  });

  it("serverChangesEntry: only a different revision or content counts", () => {
    const e = entryFromDetail(detail("a", { revision: 3, document: X, publicationState: "draft" }), meta);
    expect(serverChangesEntry(e, detail("a", { revision: 3, document: X, publicationState: "published" }))).toBe(false);
    expect(serverChangesEntry(e, detail("a", { revision: 4, document: X }))).toBe(true);
    expect(serverChangesEntry(e, detail("a", { revision: 3, document: Y }))).toBe(true);
  });
});

describe("empty drafts are not waiting to publish", () => {
  const entry = (over: Partial<PresentationDetail>) => entryFromDetail(detail("e", over), meta);

  it("a never-published product with no settings has nothing to publish, however the row got there", () => {
    expect(hasPendingPublish(entry({ revision: 1, publicationState: "draft" }))).toBe(false);
    expect(isWaitingToPublish(entry({ revision: 1, publicationState: "draft", document: { schemaVersion: 1, gallery: {} } }))).toBe(false);
  });

  it("a never-published product with real settings is waiting", () => {
    expect(isWaitingToPublish(entry({ revision: 1, publicationState: "draft", document: X }))).toBe(true);
  });

  it("a published product is waiting only when its draft differs from the live copy", () => {
    expect(isWaitingToPublish(entry({ revision: 2, publicationState: "published", document: X, publishedDocument: X }))).toBe(false);
    expect(isWaitingToPublish(entry({ revision: 2, publicationState: "published_with_changes", document: Y, publishedDocument: X }))).toBe(true);
    // everything reverted after publishing: the empty draft differs from the live copy, so taking the live settings away needs a publish
    expect(isWaitingToPublish(entry({ revision: 3, publicationState: "published_with_changes", document: { schemaVersion: 1 }, publishedDocument: X }))).toBe(true);
  });

  it("an unsaved change that ends up empty on a never-published product is not waiting either", () => {
    let s = putEntry(createPresentationStore(), entry({ revision: 1, publicationState: "draft", document: X }));
    s = setGalleryLayout(s, "e", undefined);
    expect(isEntryDirty(s.entries.e)).toBe(true); // the stored draft still has X, so this is an unsaved change...
    expect(hasPendingPublish(s.entries.e)).toBe(false); // ...but there is nothing to go live
  });

  it("the publish summary leaves out empty drafts, loaded or only listed", () => {
    let s = createPresentationStore();
    s = putEntry(s, entryFromDetail(detail("loaded-empty", { revision: 1, publicationState: "draft" }), meta));
    s = putEntry(s, entryFromDetail(detail("loaded-real", { revision: 1, publicationState: "draft", document: Y }), meta));
    const list = [
      { productId: "loaded-empty", publicationState: "draft" as const },
      { productId: "loaded-real", publicationState: "draft" as const },
      { productId: "listed-empty", publicationState: "draft" as const },
      { productId: "listed-real", publicationState: "draft" as const },
      { productId: "listed-changes", publicationState: "published_with_changes" as const },
    ];
    const checks = new Map([["listed-empty", "empty" as const], ["listed-real", "real" as const]]);
    const { waiting, unverified } = summarizeWaiting(list, s, checks);
    expect([...waiting].sort()).toEqual(["listed-changes", "listed-real", "loaded-real"]);
    expect(unverified.size).toBe(0);
  });

  it("Publish this product stays off for an empty never-published draft and on for real changes", () => {
    const ok = { loadStatus: "ready" as const, canEdit: true, busy: false };
    expect(productActions({ ...ok, entry: entry({ revision: 1, publicationState: "draft" }) }).publish).toBe(false);
    expect(productActions({ ...ok, entry: entry({ revision: 1, publicationState: "draft", document: X }) }).publish).toBe(true);
    expect(productActions({ ...ok, entry: entry({ revision: 2, publicationState: "published", document: X, publishedDocument: X }) }).publish).toBe(false);
    // a real edit not yet saved on a never-published product
    const typed = setGalleryLayout(putEntry(createPresentationStore(), entry({})), "e", "stacked").entries.e;
    expect(productActions({ ...ok, entry: typed }).publish).toBe(true);
  });
});

describe("a newer schema version is never edited, saved or downgraded", () => {
  const future = { schemaVersion: 2, gallery: { layout: "masonry" }, newThing: { a: 1 } };
  const make = () => putEntry(createPresentationStore(), entryFromDetail(detail("f", { revision: 7, publicationState: "published", document: future, publishedDocument: future }), meta));

  it("is recognised, with the version it declares", () => {
    expect(unsupportedVersionOf(future)).toEqual({ version: 2 });
    expect(unsupportedVersionOf({ gallery: {} })).toEqual({ version: null });
    expect(unsupportedVersionOf({ schemaVersion: 1 })).toBeNull();
    expect(make().entries.f.unsupported).toEqual({ version: 2 });
  });

  it("every edit is refused, so nothing can become dirty and nothing is autosaved", () => {
    const s0 = make();
    let s = setGalleryLayout(s0, "f", "stacked");
    s = setMediaPosition(s, "f", "right");
    s = setFocalPoint(s, "f", { x: 1, y: 1 });
    s = setBlockHidden(s, "f", "product-sku", true);
    expect(s).toBe(s0);
    expect(isEntryDirty(s.entries.f)).toBe(false);
    expect(dirtyEntries(s)).toHaveLength(0);
  });

  it("cannot be published or edited from the controls, but may still be reset by the owner", () => {
    const s = make();
    expect(productActions({ loadStatus: "ready", canEdit: true, busy: false, entry: s.entries.f })).toEqual({ edit: false, publish: false, reset: true });
    expect(hasPendingPublish(s.entries.f)).toBe(false);
  });

  it("is not counted as waiting to publish, and undo steps are never restored into it", () => {
    const s = make();
    expect(summarizeWaiting([{ productId: "f", publicationState: "published_with_changes" }], s).waiting.has("f")).toBe(false);
    expect(restoreDrafts(s, { f: { raw: JSON.stringify(X), key: "x", epoch: 0 } })).toBe(s);
    expect(discardChanges(s, "f")).toBe(s);
  });

  it("a server copy that turns unsupported (or supported) counts as a change", () => {
    const supported = entryFromDetail(detail("f", { revision: 7, document: X }), meta);
    expect(serverChangesEntry(supported, detail("f", { revision: 7, document: future }))).toBe(true);
    expect(serverChangesEntry(make().entries.f, detail("f", { revision: 7, document: X }))).toBe(true);
  });
});

describe("product controls while another product loads", () => {
  const clean = entryFromDetail(detail("a", { revision: 2, publicationState: "published_with_changes", document: X, publishedDocument: Y }), meta);
  const base = { canEdit: true, busy: false, entry: clean };

  it("nothing may act while a product is loading", () => {
    expect(productActions({ ...base, loadStatus: "loading" })).toEqual({ edit: false, publish: false, reset: false });
  });
  it("once loaded the controls come back", () => {
    expect(productActions({ ...base, loadStatus: "ready" })).toEqual({ edit: true, publish: true, reset: true });
    expect(productActions({ ...base, loadStatus: "error" }).edit).toBe(true);
  });
  it("nothing acts without edit permission, during a publish or reset, or without an entry", () => {
    expect(productActions({ ...base, loadStatus: "ready", canEdit: false })).toEqual({ edit: false, publish: false, reset: false });
    expect(productActions({ ...base, loadStatus: "ready", busy: true })).toEqual({ edit: false, publish: false, reset: false });
    expect(productActions({ ...base, loadStatus: "ready", entry: null })).toEqual({ edit: false, publish: false, reset: false });
  });
  it("a product never customized cannot be reset, one with unsaved edits can", () => {
    const fresh = entryFromDetail(detail("n"), meta);
    expect(productActions({ ...base, loadStatus: "ready", entry: fresh }).reset).toBe(false);
    const typed = setGalleryLayout(putEntry(createPresentationStore(), fresh), "n", "stacked").entries.n;
    expect(productActions({ ...base, loadStatus: "ready", entry: typed }).reset).toBe(true);
  });
});

describe("publish-all errors name the product", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";

  it("groups product errors by product and path, and leaves the rest alone", () => {
    const { byProduct, other } = splitProductFieldErrors({
      [`productPresentation.${A}.gallery.layout`]: "Layout must be one of: thumbnails, stacked.",
      [`productPresentation.${A}.focalPoint.x`]: "x must be a number from 0 to 100.",
      [`productPresentation.${B}`]: "The document is too large.",
      "index.sections.hero.settings.link": "Not a valid link",
    });
    expect(byProduct).toEqual({
      [A]: { "gallery.layout": "Layout must be one of: thumbnails, stacked.", "focalPoint.x": "x must be a number from 0 to 100." },
      [B]: { "": "The document is too large." },
    });
    expect(other).toEqual({ "index.sections.hero.settings.link": "Not a valid link" });
  });

  it("errors with no product in them are all 'other' (generic handling); undefined is safe", () => {
    expect(splitProductFieldErrors({ "theme_settings.settings.colors.primary": "bad" })).toEqual({ byProduct: {}, other: { "theme_settings.settings.colors.primary": "bad" } });
    expect(splitProductFieldErrors(undefined)).toEqual({ byProduct: {}, other: {} });
    expect(splitProductFieldErrors({ "productPresentation.not-an-id.x": "y" }).byProduct).toEqual({});
  });
});

describe("server epochs in the undo history", () => {
  const withEpoch = (epoch: number, doc: unknown) => snapshotOf({}, { p: { document: doc, epoch } });

  it("a document in a new epoch is the server's copy arriving, not an edit", () => {
    expect(changedBetween(withEpoch(0, { a: 1 }), withEpoch(1, { a: 2 }))).toBe(false);
    expect(changedBetween(withEpoch(1, { a: 1 }), withEpoch(1, { a: 2 }))).toBe(true);
  });

  it("applying a step never replaces a document that is now in another epoch", () => {
    const now = withEpoch(2, { a: "server" });
    expect(mergeRestored(now, withEpoch(1, { a: "old" })).pres.p.key).toBe(now.pres.p.key);
    const same = withEpoch(2, { a: "undone" });
    expect(mergeRestored(now, same).pres.p.key).toBe(same.pres.p.key);
  });

  it("pages and shared parts are matched by presence, as before", () => {
    const now = snapshotOf({ a: { document: { v: 2 } } }, {});
    const step = snapshotOf({ a: { document: { v: 1 } }, gone: { document: { v: 9 } } }, {});
    const merged = mergeRestored(now, step);
    expect(merged.docs.a.key).toBe(step.docs.a.key);
    expect("gone" in merged.docs).toBe(false);
  });
});
