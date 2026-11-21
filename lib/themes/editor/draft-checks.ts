import type { PresentationSummary } from "@/lib/themes/types";

/**
 * Telling empty drafts from real ones, for the publish summary.
 *
 * The API's list of customized products carries states only (id, revision, state, timestamps): it cannot say whether a
 * never-published draft is empty (everything reverted, which publishing ignores) or holds real settings. Only reading the
 * product can. So each never-published row is read once, in chunks, and the answer is remembered by
 * (product, revision, updated-at): a row changes revision (or is re-created with a new timestamp) whenever its content
 * can have changed, so a remembered answer is never stale and a row is never read twice.
 *
 * A row that could not be read, or that is past the limit, stays UNVERIFIED. It is reported as such and never guessed
 * to be empty or real, so a count is never presented as more certain than it is.
 */

export type DraftCheck = "empty" | "real";

/** Ids per server call (the action accepts 50). */
export const CHECK_CHUNK = 50;
/** Most rows read per pass; the rest stay unverified (and are said to be). */
export const CHECK_LIMIT = 500;

type Row = Pick<PresentationSummary, "productId" | "revision" | "updatedAt">;

export const draftKey = (r: Row): string => `${r.productId}:${r.revision}:${r.updatedAt}`;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type ChunkResult = { empty: string[]; real: string[] };

export type CheckOutcome = {
  /** Chunks whose read failed outright (their rows stay unverified and are tried again next time). */
  failedChunks: number;
  /** Rows beyond the limit, not read in this pass. */
  skipped: number;
  /** Rows read in this pass. */
  read: number;
};

/**
 * Reads every row that has no remembered answer, chunk by chunk, and remembers the answers in `cache`. A failed chunk does
 * not stop the others, and a product the server could not read (named in neither list) stays unverified.
 */
export async function runDraftChecks(rows: readonly Row[], cache: Map<string, DraftCheck>, fetchChunk: (ids: string[]) => Promise<ChunkResult>): Promise<CheckOutcome> {
  const unknown = rows.filter((r) => !cache.has(draftKey(r)));
  const wanted = unknown.slice(0, CHECK_LIMIT);
  const outcome: CheckOutcome = { failedChunks: 0, skipped: unknown.length - wanted.length, read: 0 };
  for (const part of chunk(wanted, CHECK_CHUNK)) {
    try {
      const result = await fetchChunk(part.map((r) => r.productId));
      const empty = new Set(result.empty);
      const real = new Set(result.real);
      for (const r of part) {
        if (empty.has(r.productId)) cache.set(draftKey(r), "empty");
        else if (real.has(r.productId)) cache.set(draftKey(r), "real");
        // else: the server could not read it; it stays unverified.
      }
      outcome.read += part.length;
    } catch {
      outcome.failedChunks += 1;
    }
  }
  return outcome;
}

/** The answers known for these rows, by product id. */
export function checksFor(rows: readonly Row[], cache: ReadonlyMap<string, DraftCheck>): Map<string, DraftCheck> {
  const out = new Map<string, DraftCheck>();
  for (const r of rows) {
    const c = cache.get(draftKey(r));
    if (c) out.set(r.productId, c);
  }
  return out;
}

/** Never-published rows of the list that are not loaded in the editor (a loaded product is judged from its own document). */
export function draftsToCheck(list: readonly PresentationSummary[], loaded: ReadonlySet<string>): PresentationSummary[] {
  return list.filter((r) => r.publicationState === "draft" && !loaded.has(r.productId));
}

/** A short, order-independent fingerprint of the rows to check, for a cache key (two 32-bit hashes and the count). */
export function signatureOf(rows: readonly Row[]): string {
  const keys = rows.map(draftKey).sort();
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (const k of keys) {
    for (let i = 0; i < k.length; i += 1) {
      a = Math.imul(a ^ k.charCodeAt(i), 0x01000193) >>> 0;
      b = Math.imul(b + k.charCodeAt(i), 0x85ebca6b) >>> 0;
    }
    a = Math.imul(a ^ 0x7c, 0x01000193) >>> 0;
  }
  return `${keys.length}:${a.toString(16)}:${b.toString(16)}`;
}
