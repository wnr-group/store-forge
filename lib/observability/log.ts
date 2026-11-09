/**
 * Structured logging for server code. One JSON object per line, so a hosting platform's log search can filter on fields
 * (`event`, `operation`, `code`, `outcome`). Nothing sensitive is written:
 *   - values under keys that look like credentials (password, token, secret, cookie, ...) are replaced,
 *   - free text is cleaned: bound SQL parameters, connection strings, tokens, e-mail addresses and long hex strings are removed,
 *   - request headers and bodies are never logged.
 * Dependency-free on purpose: it runs in the Node and Edge runtimes and in tests.
 */

export type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential|session|jwt|signature)/i;

/** Removes what must never reach a log from a piece of text, and shortens it. */
export function sanitizeText(input: string, max = 300): string {
  let s = String(input);
  s = s.replace(/\bparams:[\s\S]*$/i, "params: [omitted]"); // drizzle appends the bound parameter values to failed-query messages
  s = s.replace(/postgres(?:ql)?:\/\/\S+/gi, "[connection-string]");
  s = s.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, "[jwt]");
  s = s.replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
  s = s.replace(/\bsb_[a-z]+_[A-Za-z0-9_-]{10,}/g, "[key]");
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
  s = s.replace(/\b[A-Fa-f0-9]{32,}\b/g, "[hex]");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  return String(value);
}

export type ErrorSummary = { name: string; code?: string; message: string; digest?: string };

/** A safe description of anything thrown: its type, our error code if it has one, a cleaned message and the causes' messages. */
export function describeError(error: unknown): ErrorSummary {
  const parts: string[] = [];
  let first: Error | undefined;
  for (let e: unknown = error, i = 0; i < 4 && e instanceof Error; e = e.cause, i++) {
    first ??= e;
    parts.push(e.message);
  }
  const digest = (error as { digest?: unknown } | null)?.digest;
  const code = (error as { code?: unknown } | null)?.code;
  return {
    name: first?.name ?? typeof error,
    ...(typeof code === "string" ? { code } : {}),
    message: sanitizeText(parts.length ? parts.join(" | ") : String(error)),
    ...(typeof digest === "string" ? { digest } : {}),
  };
}

/** Writes one structured line. Errors go to stderr, the rest to stdout. */
export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...(redact(fields) as Record<string, unknown>) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
