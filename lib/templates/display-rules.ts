/**
 * Display rules (document schema v2): when and where a section or block is shown. Plain data and pure functions only (no React,
 * no schema imports), so the validator, the renderer and the migration all read the same definitions.
 *
 *   node.display = { v: 1, rules: [ { type: "schedule", startsAt, endsAt, timezone }, { type: "device", desktop, tablet, mobile } ] }
 *
 * Rules are ANDed. A schedule is evaluated on the SERVER against absolute instants: an inactive node is omitted from the HTML,
 * never sent and then hidden. A device rule is CSS only and is never a security mechanism: the node is still in the page.
 * Nothing a merchant writes reaches CSS as text: the device helper returns fixed class names chosen from a closed set.
 */
import { z } from "zod";
import type { BreakpointKey } from "./breakpoints";

export type ScheduleRule = { type: "schedule"; startsAt?: string; endsAt?: string; timezone?: string };
export type DeviceRule = { type: "device"; desktop: boolean; tablet: boolean; mobile: boolean };
export type DisplayRule = ScheduleRule | DeviceRule;
export type DisplayRules = { v: 1; rules: DisplayRule[] };

export const DISPLAY_RULES_VERSION = 1;
/** One schedule and one device rule at most, so the bound is two; kept as a named limit for the schema and the editor. */
export const MAX_DISPLAY_RULES = 2;
const MAX_TIMEZONE_LENGTH = 64;

export type DisplayState = "always" | "upcoming" | "active" | "expired";
export type DisplayEvaluation = { show: boolean; state: DisplayState };

// ---- validation ---------------------------------------------------------------------------------------------------

/** An ISO 8601 date-time with seconds optional and an explicit offset (`Z` for UTC): an absolute instant, never a local time. */
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** The instant in epoch milliseconds, or null for anything that is not a real calendar instant in the strict form above. */
export function parseInstant(value: unknown): number | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const m = ISO_INSTANT.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const instantSchema = z.string().refine((v) => parseInstant(v) !== null, "Must be an ISO date and time with an offset, such as 2026-12-01T09:00:00Z");

const timezoneSchema = z
  .string()
  .min(1)
  .max(MAX_TIMEZONE_LENGTH)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Not a known time zone");

const scheduleRuleSchema = z
  .object({ type: z.literal("schedule"), startsAt: instantSchema.optional(), endsAt: instantSchema.optional(), timezone: timezoneSchema.optional() })
  .strict()
  .refine((r) => r.startsAt !== undefined || r.endsAt !== undefined, "A schedule needs a start, an end or both")
  .refine((r) => {
    if (r.startsAt === undefined || r.endsAt === undefined) return true;
    return (parseInstant(r.endsAt) as number) > (parseInstant(r.startsAt) as number);
  }, "The end must be after the start");

const deviceRuleSchema = z.object({ type: z.literal("device"), desktop: z.boolean(), tablet: z.boolean(), mobile: z.boolean() }).strict();

const ruleSchema = z.union([scheduleRuleSchema, deviceRuleSchema]);

/** Strict: an unknown key, a second schedule, a second device rule or more than MAX_DISPLAY_RULES rules is an error. */
export const displayRulesSchema: z.ZodType<DisplayRules> = z
  .object({ v: z.literal(DISPLAY_RULES_VERSION), rules: z.array(ruleSchema).max(MAX_DISPLAY_RULES) })
  .strict()
  .refine((d) => d.rules.filter((r) => r.type === "schedule").length <= 1, "Only one schedule is allowed")
  .refine((d) => d.rules.filter((r) => r.type === "device").length <= 1, "Only one device rule is allowed") as z.ZodType<DisplayRules>;

export function parseDisplayRules(input: unknown): DisplayRules | null {
  const r = displayRulesSchema.safeParse(input);
  return r.success ? r.data : null;
}

// ---- evaluation ---------------------------------------------------------------------------------------------------

const toMs = (now: Date | number | string): number => (now instanceof Date ? now.getTime() : typeof now === "string" ? Date.parse(now) : now);

/**
 * Whether the node is shown at `now` (the server clock, injected). The start is inclusive and the end exclusive, so a node
 * ends exactly at `endsAt`. Device rules do not take part: they never hide a node from the HTML. A malformed schedule or an
 * unreadable `now` fails closed (hidden), because a rule that cannot be understood must not publish content early.
 */
export function evaluateDisplay(rules: DisplayRules | null | undefined, now: Date | number | string): DisplayEvaluation {
  const schedules = (rules?.rules ?? []).filter((r): r is ScheduleRule => r?.type === "schedule");
  if (schedules.length === 0) return { show: true, state: "always" };
  const t = toMs(now);
  if (!Number.isFinite(t)) return { show: false, state: "expired" };
  let state: DisplayState = "active";
  for (const s of schedules) {
    const start = s.startsAt === undefined ? null : parseInstant(s.startsAt);
    const end = s.endsAt === undefined ? null : parseInstant(s.endsAt);
    if ((s.startsAt !== undefined && start === null) || (s.endsAt !== undefined && end === null) || (start === null && end === null)) {
      return { show: false, state: "expired" };
    }
    if (end !== null && t >= end) return { show: false, state: "expired" };
    if (start !== null && t < start) state = "upcoming";
  }
  return { show: state === "active", state };
}

// ---- device CSS ---------------------------------------------------------------------------------------------------

/**
 * Closed set of class names, written out in full so Tailwind generates them. Ranges match lib/templates/breakpoints.ts:
 * mobile below 768px, tablet 768 to 1279px, desktop from 1280px.
 */
const HIDE_CLASS: Readonly<Record<BreakpointKey, string>> = Object.freeze({
  mobile: "max-[767px]:hidden",
  tablet: "min-[768px]:max-[1279px]:hidden",
  desktop: "min-[1280px]:hidden",
});
const DEVICE_ORDER: readonly BreakpointKey[] = ["mobile", "tablet", "desktop"];

export type DeviceCss = { className: string; hide: string };

/**
 * The wrapper for a node that hides on some devices, or null when it shows on all of them. `className` is `contents` (the wrapper
 * has no box, so a sticky header keeps working) plus one fixed hide class per hidden device; `hide` is the bounded value for a
 * `data-sf-hide` attribute. The input is read as booleans only, so nothing from user data is ever copied into the output.
 */
export function deviceCss(rules: DisplayRules | null | undefined): DeviceCss | null {
  const device = rules?.rules?.find((r): r is DeviceRule => r?.type === "device");
  if (!device) return null;
  const hidden = DEVICE_ORDER.filter((d) => device[d] === false);
  if (hidden.length === 0) return null;
  return { className: ["contents", ...hidden.map((d) => HIDE_CLASS[d])].join(" "), hide: hidden.join(" ") };
}

/** Whether a device rule says the node is shown on `device` (true when there is no device rule). */
export function visibleOnDevice(rules: DisplayRules | null | undefined, device: BreakpointKey): boolean {
  const rule = rules?.rules?.find((r): r is DeviceRule => r?.type === "device");
  return rule ? rule[device] !== false : true;
}
