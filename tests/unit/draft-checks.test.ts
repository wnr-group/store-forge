import { describe, expect, it, vi } from "vitest";
import { CHECK_CHUNK, CHECK_LIMIT, checksFor, chunk, draftKey, draftsToCheck, runDraftChecks, signatureOf, type ChunkResult, type DraftCheck } from "@/lib/themes/editor/draft-checks";
import { createPresentationStore, entryFromDetail, putEntry, summarizeWaiting } from "@/lib/themes/editor/presentation-state";
import type { PresentationSummary } from "@/lib/themes/types";

/** Empty-draft counting for the publish summary: pagination, remembering, failures, and never guessing. */

const row = (i: number, over: Partial<PresentationSummary> = {}): PresentationSummary => ({
  productId: `p${i}`, revision: 1, publicationState: "draft", publishedAt: null, updatedAt: "2026-01-01T00:00:00.000Z", ...over,
});
const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => row(from + i));
/** A fake server: even-numbered products are empty drafts, odd ones are real. */
const server = (fail: (ids: string[]) => boolean = () => false) =>
  vi.fn(async (ids: string[]): Promise<ChunkResult> => {
    if (fail(ids)) throw new Error("down");
    return { empty: ids.filter((id) => Number(id.slice(1)) % 2 === 0), real: ids.filter((id) => Number(id.slice(1)) % 2 === 1) };
  });

describe("which rows are checked", () => {
  it("only never-published rows that are not loaded in the editor", () => {
    const list = [row(1), row(2, { publicationState: "published" }), row(3, { publicationState: "published_with_changes" }), row(4), row(5, { publicationState: "default" })];
    expect(draftsToCheck(list, new Set(["p4"])).map((r) => r.productId)).toEqual(["p1"]);
  });
  it("chunks evenly", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
});

describe("paging through many drafts", () => {
  it("checks every row beyond the first 50, in chunks of 50", async () => {
    const cache = new Map<string, DraftCheck>();
    const fetch = server();
    const outcome = await runDraftChecks(rows(120), cache, fetch);
    expect(fetch.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    expect(outcome).toEqual({ failedChunks: 0, skipped: 0, read: 120 });
    expect(cache.size).toBe(120);
  });

  it("the publish summary is exact for 120 drafts, 60 of them empty", async () => {
    const list = rows(120);
    const cache = new Map<string, DraftCheck>();
    await runDraftChecks(list, cache, server());
    const { waiting, unverified } = summarizeWaiting(list, createPresentationStore(), checksFor(list, cache));
    expect(waiting.size).toBe(60); // the odd (real) ones
    expect(unverified.size).toBe(0);
    expect(waiting.has("p3")).toBe(true);
    expect(waiting.has("p4")).toBe(false);
  });

  it("rows beyond the limit are reported as skipped and stay unverified, never counted either way", async () => {
    const list = rows(CHECK_LIMIT + 30);
    const cache = new Map<string, DraftCheck>();
    const outcome = await runDraftChecks(list, cache, server());
    expect(outcome.skipped).toBe(30);
    expect(outcome.read).toBe(CHECK_LIMIT);
    const { waiting, unverified } = summarizeWaiting(list, createPresentationStore(), checksFor(list, cache));
    expect(unverified.size).toBe(30);
    expect(waiting.size + 0).toBe(CHECK_LIMIT / 2);
  });
});

describe("no repeated calls", () => {
  it("a row already answered is never read again, even when the list changes", async () => {
    const cache = new Map<string, DraftCheck>();
    const fetch = server();
    await runDraftChecks(rows(60), cache, fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    await runDraftChecks(rows(60), cache, fetch); // nothing changed
    expect(fetch).toHaveBeenCalledTimes(2);
    await runDraftChecks(rows(61), cache, fetch); // one more row
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toEqual(["p60"]);
  });

  it("a row whose revision (or re-creation time) changed is read again: the old answer cannot be stale", async () => {
    const cache = new Map<string, DraftCheck>();
    const fetch = server();
    await runDraftChecks([row(2)], cache, fetch);
    await runDraftChecks([row(2, { revision: 2 })], cache, fetch);
    await runDraftChecks([row(2, { updatedAt: "2026-02-02T00:00:00.000Z" })], cache, fetch);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(draftKey(row(2))).not.toBe(draftKey(row(2, { revision: 2 })));
  });

  it("the cache fingerprint ignores order and changes with the rows", () => {
    expect(signatureOf([row(1), row(2)])).toBe(signatureOf([row(2), row(1)]));
    expect(signatureOf([row(1), row(2)])).not.toBe(signatureOf([row(1), row(3)]));
    expect(signatureOf([row(1)])).not.toBe(signatureOf([row(1, { revision: 2 })]));
    expect(signatureOf([])).toBe(signatureOf([]));
  });
});

describe("errors never produce a misleading count", () => {
  it("a failed chunk leaves its rows unverified; the others are still answered; a later pass reads only the failed ones", async () => {
    const cache = new Map<string, DraftCheck>();
    let broken = true;
    const fetch = server((ids) => broken && ids.includes("p60"));
    const list = rows(120);
    const outcome = await runDraftChecks(list, cache, fetch);
    expect(outcome.failedChunks).toBe(1);
    const first = summarizeWaiting(list, createPresentationStore(), checksFor(list, cache));
    expect(first.unverified.size).toBe(50); // the failed chunk (p50-p99), not guessed
    expect(first.waiting.size).toBe(35); // 25 real in chunk 1 + 10 real in chunk 3, none from the failed chunk

    broken = false;
    fetch.mockClear();
    await runDraftChecks(list, cache, fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toHaveLength(50);
    const second = summarizeWaiting(list, createPresentationStore(), checksFor(list, cache));
    expect(second.unverified.size).toBe(0);
    expect(second.waiting.size).toBe(60);
  });

  it("a product the server could not read (named in neither group) stays unverified", async () => {
    const cache = new Map<string, DraftCheck>();
    await runDraftChecks(rows(3), cache, async () => ({ empty: ["p0"], real: ["p1"] }));
    const { waiting, unverified } = summarizeWaiting(rows(3), createPresentationStore(), checksFor(rows(3), cache));
    expect([...waiting]).toEqual(["p1"]);
    expect([...unverified]).toEqual(["p2"]);
  });

  it("with no answers at all nothing is counted as waiting or as empty", () => {
    const { waiting, unverified } = summarizeWaiting(rows(4), createPresentationStore());
    expect(waiting.size).toBe(0);
    expect(unverified.size).toBe(4);
  });
});

describe("empty-draft counting in the summary", () => {
  it("published-with-changes rows always count; published and default rows never do", () => {
    const list = [row(1, { publicationState: "published_with_changes" }), row(2, { publicationState: "published" }), row(3, { publicationState: "default" })];
    const { waiting, unverified } = summarizeWaiting(list, createPresentationStore());
    expect([...waiting]).toEqual(["p1"]);
    expect(unverified.size).toBe(0);
  });

  it("a product loaded in the editor is judged from its own document, whatever the list or checks say", () => {
    const list = [row(1), row(2)];
    let s = createPresentationStore();
    // p1: loaded, empty never-published draft; p2: loaded, real settings
    s = putEntry(s, entryFromDetail({ productId: "p1", revision: 1, publicationState: "draft", document: { schemaVersion: 1 }, publishedDocument: null, publishedAt: null, updatedAt: null }, { name: "One", slug: "one" }));
    s = putEntry(s, entryFromDetail({ productId: "p2", revision: 1, publicationState: "draft", document: { schemaVersion: 1, hiddenBlocks: ["social-share"] }, publishedDocument: null, publishedAt: null, updatedAt: null }, { name: "Two", slug: "two" }));
    const wrongChecks = new Map<string, DraftCheck>([["p1", "real"], ["p2", "empty"]]);
    const { waiting, unverified } = summarizeWaiting(list, s, wrongChecks);
    expect([...waiting]).toEqual(["p2"]);
    expect(unverified.size).toBe(0);
  });

  it("the limits are what the server action accepts", () => {
    expect(CHECK_CHUNK).toBe(50);
    expect(CHECK_LIMIT % CHECK_CHUNK).toBe(0);
  });
});
