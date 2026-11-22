/**
 * Wall-clock time in a store's time zone <-> absolute UTC instants, with Intl only (no dependency). The "When to show" panel lets a
 * merchant pick a date and time as the store's clock reads it; a schedule stores the UTC instant (see lib/templates/display-rules.ts).
 * Plain data and pure functions. A wall time that does not exist (clocks jump forward) is not guessed: it returns null.
 */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatters.set(timeZone, f);
    return f;
  } catch {
    return null;
  }
}

/** Whether `timeZone` is a zone this runtime knows. */
export const isKnownTimeZone = (timeZone: string): boolean => formatterFor(timeZone) !== null;

/** The zone's offset from UTC at an instant, in ms (positive east of Greenwich). */
function offsetAt(instantMs: number, f: Intl.DateTimeFormat): number {
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(instantMs))) if (part.type !== "literal") p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** The instant as `YYYY-MM-DDTHH:mm` on the zone's wall clock (the value a datetime-local input takes), or null for an unreadable input. */
export function utcIsoToZonedLocal(iso: string | number | undefined, timeZone: string): string | null {
  const f = formatterFor(timeZone);
  const ms = typeof iso === "number" ? iso : typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!f || !Number.isFinite(ms)) return null;
  const wall = new Date(ms + offsetAt(ms, f));
  return `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
}

/**
 * The UTC instant (ISO 8601 with `Z`, no milliseconds) at which the zone's clock reads `local` (`YYYY-MM-DDTHH:mm`). A time the clock
 * repeats (clocks go back) is the earlier of the two; a time it skips (clocks go forward) and anything unreadable is null.
 */
export function zonedLocalToUtcIso(local: string, timeZone: string): string | null {
  const f = formatterFor(timeZone);
  const m = LOCAL.exec(local);
  if (!f || !m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wallAsUtc);
  // Rejects 31 February, hour 25 and the like: Date.UTC rolls them over.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || check.getUTCHours() !== h || check.getUTCMinutes() !== mi) return null;
  const offsets = new Set([offsetAt(wallAsUtc - DAY_MS, f), offsetAt(wallAsUtc + DAY_MS, f)]);
  const matches = [...offsets].map((o) => wallAsUtc - o).filter((t) => utcIsoToZonedLocal(t, timeZone) === local);
  if (matches.length === 0) return null;
  return new Date(Math.min(...matches)).toISOString().replace(".000Z", "Z");
}
