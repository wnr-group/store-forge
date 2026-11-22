/**
 * Countdown section logic: a countdown to ONE fixed moment, the same for every visitor. Pure functions only (no React, no clock
 * reads): the server passes its own clock in, and the client component works from that value plus a one-off offset.
 *
 * There is deliberately no evergreen, per-visitor, rolling or auto-reset mode: a countdown that restarts for each visitor is a
 * false-urgency pattern, so no setting, option or code path for it exists (see the negative test in tests/unit/countdown.test.ts).
 */
import type { ComponentNode } from "./document";
import { parseDisplayRules, parseInstant, type ScheduleRule } from "./display-rules";

export const COUNTDOWN_TARGET_MODES = ["schedule-end", "fixed"] as const;
export type CountdownTargetMode = (typeof COUNTDOWN_TARGET_MODES)[number];
export const COUNTDOWN_END_BEHAVIOURS = ["hide", "message"] as const;
export type CountdownEndBehaviour = (typeof COUNTDOWN_END_BEHAVIOURS)[number];

/** The only setting ids a countdown has. A test pins this list. */
export const COUNTDOWN_SETTING_IDS = Object.freeze(["heading", "targetMode", "fixedAt", "endBehavior", "endMessage"] as const);

export const COUNTDOWN_LIMITS = Object.freeze({ heading: 80, endMessage: 160 });

export type CountdownSettings = {
  heading: string;
  targetMode: CountdownTargetMode;
  fixedAt: string;
  endBehavior: CountdownEndBehaviour;
  endMessage: string;
};

const asText = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

export function readCountdownSettings(settings: Record<string, unknown> | undefined): CountdownSettings {
  const s = settings ?? {};
  return {
    heading: asText(s.heading),
    targetMode: s.targetMode === "fixed" ? "fixed" : "schedule-end",
    fixedAt: asText(s.fixedAt),
    endBehavior: s.endBehavior === "message" ? "message" : "hide",
    endMessage: asText(s.endMessage).trim(),
  };
}

/** The end of the node's own display schedule (epoch ms), or null when it has none. */
export function scheduleEndOf(display: unknown): number | null {
  const rules = parseDisplayRules(display);
  const schedule = rules?.rules.find((r): r is ScheduleRule => r.type === "schedule");
  if (!schedule || schedule.endsAt === undefined) return null;
  return parseInstant(schedule.endsAt);
}

/** The countdown's target instant (epoch ms), or null when it is not set or not a real instant. */
export function countdownTarget(node: Pick<ComponentNode, "settings" | "display">): number | null {
  const s = readCountdownSettings(node.settings);
  return s.targetMode === "fixed" ? parseInstant(s.fixedAt) : scheduleEndOf(node.display);
}

/**
 * True when the section must stay in the page after its own schedule has ended: a countdown that follows the schedule end and shows
 * a message at zero. The schedule's end is then handled by the countdown itself (see `isNodeActive`), not by pruning.
 */
export function countdownKeepsAfterEnd(node: Pick<ComponentNode, "type" | "settings">): boolean {
  if (node.type !== "countdown") return false;
  const s = readCountdownSettings(node.settings);
  return s.targetMode === "schedule-end" && s.endBehavior === "message" && s.endMessage.length > 0;
}

export const remainingMs = (target: number, now: number): number => target - now;

export type ClockParts = { days: number; hours: number; minutes: number; seconds: number };

/** Whole days, hours, minutes and seconds left (rounded up to the next second so "0s" only shows at the end). Never negative. */
export function splitRemaining(ms: number): ClockParts {
  const total = Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0;
  return { days: Math.floor(total / 86_400), hours: Math.floor((total % 86_400) / 3_600), minutes: Math.floor((total % 3_600) / 60), seconds: total % 60 };
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Plain text of the clock, e.g. "2d 03:04:05" (days only when there are some). */
export function formatClock(ms: number): string {
  const p = splitRemaining(ms);
  return `${p.days > 0 ? `${p.days}d ` : ""}${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)}`;
}

/** Screen reader milestones. A screen reader hears a polite message only when the milestone changes, never every second. */
export const COUNTDOWN_MILESTONES = Object.freeze(["long", "day", "hour", "tenMinutes", "minute", "ended"] as const);
export type CountdownMilestone = (typeof COUNTDOWN_MILESTONES)[number];

export function milestoneOf(ms: number): CountdownMilestone {
  if (!(ms > 0)) return "ended";
  if (ms <= 60_000) return "minute";
  if (ms <= 600_000) return "tenMinutes";
  if (ms <= 3_600_000) return "hour";
  if (ms <= 86_400_000) return "day";
  return "long";
}

/** Message catalogue key of the announcement for a milestone. */
export const milestoneMessageKey = (m: CountdownMilestone): `countdown.announce.${CountdownMilestone}` => `countdown.announce.${m}`;

/** The difference to add to the browser clock to get server time. Computed once, when the page loads. */
export const clockOffset = (serverNow: number, clientNow: number): number => serverNow - clientNow;
export const serverTimeAt = (clientNow: number, offset: number): number => clientNow + offset;

export type CountdownView =
  | { kind: "unset" }
  | { kind: "hidden" }
  | { kind: "running"; target: number; now: number; remaining: number }
  | { kind: "ended"; message: string };

/** What the server renders for a countdown at `serverNow`. Decided from the server clock only. */
export function resolveCountdown(node: Pick<ComponentNode, "settings" | "display">, serverNow: number): CountdownView {
  const s = readCountdownSettings(node.settings);
  const target = countdownTarget(node);
  if (target === null) return { kind: "unset" };
  const remaining = remainingMs(target, serverNow);
  if (remaining > 0) return { kind: "running", target, now: serverNow, remaining };
  if (s.endBehavior === "message" && s.endMessage) return { kind: "ended", message: s.endMessage };
  return { kind: "hidden" };
}

/** True when the countdown has no target to count to (the editor shows a hint; the public page omits it). */
export const countdownNeedsTarget = (node: Pick<ComponentNode, "settings" | "display">): boolean => countdownTarget(node) === null;

/** Problems of a countdown's settings, by setting id (only fields that are wrong). */
export function validateCountdownSettings(settings: Record<string, unknown> | undefined): Record<string, string> {
  const s = readCountdownSettings(settings);
  const raw = settings ?? {};
  const out: Record<string, string> = {};
  if (s.heading.length > COUNTDOWN_LIMITS.heading) out.heading = `Use at most ${COUNTDOWN_LIMITS.heading} characters.`;
  if (raw.targetMode !== undefined && !(COUNTDOWN_TARGET_MODES as readonly unknown[]).includes(raw.targetMode)) out.targetMode = "Choose when the countdown ends.";
  if (raw.endBehavior !== undefined && !(COUNTDOWN_END_BEHAVIOURS as readonly unknown[]).includes(raw.endBehavior)) out.endBehavior = "Choose what happens at zero.";
  // An empty or missing target is not a validation error (a new section starts that way); it renders nothing publicly and the editor says why.
  if (s.targetMode === "fixed" && s.fixedAt.trim() !== "" && parseInstant(s.fixedAt) === null) {
    out.fixedAt = "Enter a date and time with an offset, such as 2026-12-01T09:00:00Z.";
  }
  if (s.endBehavior === "message") {
    if (!s.endMessage) out.endMessage = "Write the message to show when the countdown ends.";
    else if (s.endMessage.length > COUNTDOWN_LIMITS.endMessage) out.endMessage = `Use at most ${COUNTDOWN_LIMITS.endMessage} characters.`;
  }
  return out;
}
