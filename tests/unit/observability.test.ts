import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "@/lib/actions/run";
import { AppError, toFailure } from "@/lib/errors";
import { describeError, logEvent, sanitizeText } from "@/lib/observability/log";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";

describe("sanitizeText", () => {
  it("removes bound SQL parameters from a failed-query message", () => {
    const m = sanitizeText('Failed query: select public.platform_add_admin($1, $2)\nparams: 3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40,super_admin,hunter2');
    expect(m).toBe("Failed query: select public.platform_add_admin($1, $2) params: [omitted]");
    expect(m).not.toMatch(/hunter2/);
  });

  it("removes connection strings, tokens, e-mail addresses and long hex strings", () => {
    const out = sanitizeText(`connect postgres://storeforge_app:s3cret@db.example.com:6543/postgres failed for ${JWT} (Bearer abc.def.ghi) user pat@example.test key ${"a1".repeat(20)}`);
    expect(out).not.toMatch(/s3cret|eyJ|abc\.def|pat@example|a1a1a1a1/);
    expect(out).toMatch(/\[connection-string\]/);
    expect(out).toMatch(/\[jwt\]/);
    expect(out).toMatch(/Bearer \[redacted\]/);
    expect(out).toMatch(/\[email\]/);
    expect(out).toMatch(/\[hex\]/);
  });

  it("keeps ordinary ids readable, collapses whitespace and shortens long text", () => {
    const id = "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40";
    expect(sanitizeText(`organization ${id}\n  not   found`)).toBe(`organization ${id} not found`);
    const long = sanitizeText("x".repeat(1000));
    expect(long.length).toBeLessThanOrEqual(301);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("describeError", () => {
  it("names the error, keeps our error code, and joins the causes, cleaned", () => {
    const e = new Error("Failed query: insert into x params: secret-value", { cause: new Error("connection to postgres://u:p@h/db lost") });
    const d = describeError(e);
    expect(d.name).toBe("Error");
    expect(d.message).toBe("Failed query: insert into x params: [omitted]");
    expect(describeError(new Error("outer", { cause: new Error("connection to postgres://u:p@h/db lost") })).message).toBe("outer | connection to [connection-string] lost");
    expect(describeError(new AppError("FORBIDDEN", "No."))).toMatchObject({ name: "AppError", code: "FORBIDDEN", message: "No." });
  });

  it("copes with things that are not errors, and carries Next's digest", () => {
    expect(describeError("plain text")).toMatchObject({ message: "plain text" });
    expect(describeError(Object.assign(new Error("render failed"), { digest: "1234567" })).digest).toBe("1234567");
  });
});

describe("logEvent", () => {
  let out: string[];
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => {
    out = [];
    spies.push(vi.spyOn(console, "log").mockImplementation((m: string) => void out.push(`log ${m}`)));
    spies.push(vi.spyOn(console, "warn").mockImplementation((m: string) => void out.push(`warn ${m}`)));
    spies.push(vi.spyOn(console, "error").mockImplementation((m: string) => void out.push(`error ${m}`)));
  });
  afterEach(() => spies.splice(0).forEach((s) => s.mockRestore()));

  it("writes one JSON object per line, to the stream that matches its level", () => {
    logEvent("info", "action", { operation: "admin.org.create", outcome: "ok" });
    logEvent("warn", "rate_limited", { bucket: "org.create" });
    logEvent("error", "unhandled", { error: { name: "Error" } });
    expect(out.map((l) => l.split(" ")[0])).toEqual(["log", "warn", "error"]);
    const first = JSON.parse(out[0].slice(4));
    expect(first).toMatchObject({ level: "info", event: "action", operation: "admin.org.create", outcome: "ok" });
    expect(new Date(first.time).toString()).not.toBe("Invalid Date");
  });

  it("replaces values under credential-like keys at any depth, and cleans free text", () => {
    logEvent("info", "test", {
      password: "hunter2",
      user: { name: "Pat", accessToken: "abc", nested: [{ Authorization: "Bearer xyz", ok: 1 }] },
      cookie: "sb=1",
      message: `contact pat@example.test with ${JWT}`,
    });
    const line = JSON.parse(out[0].slice(4));
    expect(line.password).toBe("[redacted]");
    expect(line.cookie).toBe("[redacted]");
    expect(line.user).toEqual({ name: "Pat", accessToken: "[redacted]", nested: [{ Authorization: "[redacted]", ok: 1 }] });
    expect(line.message).toBe("contact [email] with [jwt]");
    expect(out[0]).not.toMatch(/hunter2|abc|xyz|pat@example|eyJ/);
  });

  it("does not choke on deep, huge or odd values", () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 10; i++) cur = (cur.next = {}) as Record<string, unknown>;
    logEvent("info", "test", { deep, list: Array.from({ length: 100 }, (_, i) => i), when: new Date("2026-01-01T00:00:00Z"), nothing: null });
    const line = JSON.parse(out[0].slice(4));
    expect(line.list).toHaveLength(20);
    expect(line.when).toBe("2026-01-01T00:00:00.000Z");
    expect(JSON.stringify(line.deep)).toContain("[truncated]");
  });
});

describe("run and toFailure", () => {
  let out: string[];
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => {
    out = [];
    for (const m of ["log", "warn", "error"] as const) spies.push(vi.spyOn(console, m).mockImplementation((line: string) => void out.push(String(line))));
  });
  afterEach(() => spies.splice(0).forEach((s) => s.mockRestore()));
  const events = () => out.map((l) => JSON.parse(l) as Record<string, unknown>);

  it("logs one event per named action with its outcome, and never its result or input", async () => {
    const ok = await run(async () => ({ secretResult: "do-not-log" }), { operation: "admin.test.ok" });
    expect(ok).toEqual({ ok: true, data: { secretResult: "do-not-log" } });
    const denied = await run(async () => { throw new AppError("FORBIDDEN", "Nope."); }, { operation: "admin.test.denied" });
    expect(denied).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const [a, b] = events();
    expect(a).toMatchObject({ level: "info", event: "action", operation: "admin.test.ok", outcome: "ok" });
    expect(b).toMatchObject({ level: "warn", event: "action", operation: "admin.test.denied", outcome: "failed", code: "FORBIDDEN" });
    expect(typeof a.durationMs).toBe("number");
    expect(out.join("\n")).not.toMatch(/do-not-log/);
  });

  it("logs an unexpected error once with details (cleaned) and once as a failed action, and returns only a generic message", async () => {
    const result = await run(async () => { throw new Error("Failed query: select 1 params: s3cret-password"); }, { operation: "admin.test.boom" });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again.", code: "UNKNOWN" });
    const logged = events();
    expect(logged.map((e) => [e.level, e.event])).toEqual([["error", "unhandled"], ["error", "action"]]);
    expect(JSON.stringify(logged)).not.toMatch(/s3cret-password/);
    expect(JSON.stringify(result)).not.toMatch(/Failed query|s3cret/);
  });

  it("logs nothing for an action without an operation name, other than unexpected errors", async () => {
    await run(async () => 1);
    expect(out).toHaveLength(0);
  });

  it("still lets redirects and not-found through untouched", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    expect(() => toFailure(redirect)).toThrow(redirect);
    expect(out).toHaveLength(0);
  });
});
