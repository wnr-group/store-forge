import { describe, expect, it, vi } from "vitest";
import { createFlusher, saveFailureMessage, SETTLE_PASSES, type FlushResult } from "@/lib/themes/editor/flusher";

/** Publish waits for a save already running (autosave) instead of reading it as a failed save. */

const OK: FlushResult = { ok: true };
const deferred = () => {
  let resolve!: (r: FlushResult) => void;
  const promise = new Promise<FlushResult>((r) => { resolve = r; });
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("one save run at a time", () => {
  it("a second flush joins the run in flight instead of starting another", async () => {
    const gate = deferred();
    const run = vi.fn(() => gate.promise);
    const f = createFlusher(run);
    const a = f.flush();
    const b = f.flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(f.isRunning()).toBe(true);
    gate.resolve(OK);
    expect(await a).toEqual(OK);
    expect(await b).toEqual(OK);
    expect(f.isRunning()).toBe(false);
  });

  it("after a run ends the next flush starts a new one", async () => {
    const run = vi.fn(async () => OK);
    const f = createFlusher(run);
    await f.flush();
    await f.flush();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs never overlap, however many callers there are", async () => {
    let active = 0;
    let peak = 0;
    const f = createFlusher(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await tick();
      active -= 1;
      return OK;
    });
    await Promise.all([f.flush(), f.flush(), f.flush(), f.settle(() => true)]);
    await f.flush();
    expect(peak).toBe(1);
  });

  it("a run that throws is a failed save for everyone who joined it, never an unhandled rejection", async () => {
    const f = createFlusher(async () => {
      throw new Error("boom");
    });
    const [a, b] = await Promise.all([f.flush(), f.flush()]);
    expect(a).toEqual({ ok: false, reason: "error" });
    expect(b).toEqual(a);
    expect(f.isRunning()).toBe(false);
  });

  it("runs the latest function it was given", async () => {
    const first = vi.fn(async () => OK);
    const second = vi.fn(async () => OK);
    const f = createFlusher(first);
    f.setRun(second);
    await f.flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("settle: wait for the save in progress", () => {
  it("waits for an autosave that is running, then reports saved, without a second save", async () => {
    let dirty = true;
    const gate = deferred();
    const run = vi.fn(async () => {
      const r = await gate.promise;
      dirty = false;
      return r;
    });
    const f = createFlusher(run);
    void f.flush(); // autosave
    let settled = false;
    const publish = f.settle(() => !dirty).then((r) => { settled = true; return r; });
    await tick();
    expect(settled).toBe(false); // still waiting: it is not reported as a failure
    gate.resolve(OK);
    expect(await publish).toEqual(OK);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("with nothing unsaved and nothing running it starts no save at all (unchanged idle behaviour)", async () => {
    const run = vi.fn(async () => OK);
    const f = createFlusher(run);
    expect(await f.settle(() => true)).toEqual(OK);
    expect(run).not.toHaveBeenCalled();
  });

  it("with unsaved edits and nothing running it saves once", async () => {
    let dirty = true;
    const run = vi.fn(async () => {
      dirty = false;
      return OK;
    });
    const f = createFlusher(run);
    expect(await f.settle(() => !dirty)).toEqual(OK);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("an edit made while the save was finishing is saved by one more pass", async () => {
    let dirty = true;
    let editedDuringSave = false;
    const gate = deferred();
    const run = vi.fn(async () => {
      if (!editedDuringSave) {
        editedDuringSave = true;
        await gate.promise;
        dirty = true; // typed while the save was finishing: still unsaved after it
        return OK;
      }
      dirty = false;
      return OK;
    });
    const f = createFlusher(run);
    void f.flush();
    const publish = f.settle(() => !dirty);
    gate.resolve(OK);
    expect(await publish).toEqual(OK);
    expect(run).toHaveBeenCalledTimes(2);
    expect(dirty).toBe(false);
  });

  it("stops at the first failure and reports its reason", async () => {
    for (const reason of ["conflict", "validation", "error"] as const) {
      const gate = deferred();
      const f = createFlusher(() => gate.promise);
      void f.flush();
      const publish = f.settle(() => false);
      gate.resolve({ ok: false, reason, message: "server said no" });
      expect(await publish).toEqual({ ok: false, reason, message: "server said no" });
    }
  });

  it("a failure while it waits means no further save is attempted", async () => {
    const gate = deferred();
    const run = vi.fn(() => gate.promise);
    const f = createFlusher(run);
    void f.flush();
    const publish = f.settle(() => false);
    gate.resolve({ ok: false, reason: "error" });
    await publish;
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("a failure of its own pass is returned too", async () => {
    const f = createFlusher(async () => ({ ok: false, reason: "validation" }));
    expect(await f.settle(() => false)).toEqual({ ok: false, reason: "validation" });
  });

  it("edits that keep coming are bounded: it ends with 'busy', never with a false 'saved'", async () => {
    const run = vi.fn(async () => OK);
    const f = createFlusher(run);
    const result = await f.settle(() => false); // always dirty again
    expect(result).toEqual({ ok: false, reason: "busy" });
    expect(run).toHaveBeenCalledTimes(SETTLE_PASSES);
  });

  it("a smaller bound is respected", async () => {
    const run = vi.fn(async () => OK);
    const f = createFlusher(run);
    await f.settle(() => false, 1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("an autosave that starts while it is waiting is joined, not duplicated", async () => {
    let dirty = true;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const run = vi.fn(async () => {
      await gate;
      dirty = false;
      return OK;
    });
    const f = createFlusher(run);
    const publish = f.settle(() => !dirty); // starts the save itself
    await tick();
    void f.flush(); // the autosave timer fires meanwhile
    release();
    expect(await publish).toEqual(OK);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("saveFailureMessage says what is actually wrong", () => {
  it("one message per reason", () => {
    expect(saveFailureMessage({ ok: false, reason: "validation" })).toBe("Fix the highlighted problems before publishing.");
    expect(saveFailureMessage({ ok: false, reason: "conflict" })).toMatch(/Someone else changed this design/);
    expect(saveFailureMessage({ ok: false, reason: "busy" })).toMatch(/Click Publish again/);
    expect(saveFailureMessage({ ok: false, reason: "error", message: "Your changes could not be saved. Check your connection." })).toBe("Your changes could not be saved. Check your connection.");
    expect(saveFailureMessage({ ok: false, reason: "error" })).toBe("Your changes could not be saved. Please try again.");
  });
  it("a save still in progress is never described as a problem to fix", () => {
    for (const reason of ["conflict", "validation", "error", "busy"] as const) {
      if (reason !== "validation") expect(saveFailureMessage({ ok: false, reason })).not.toMatch(/highlighted problems/);
    }
  });
});
