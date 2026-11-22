/**
 * Display rules in the editor ("When to show"): pure helpers that read and write `node.display`, work out the navigator badges and
 * bump a document to schema 2 when it is saved with a rule. No React. Rules are described in lib/templates/display-rules.ts.
 *
 * One control for device visibility. Where Studio is on, the panel's Desktop/Tablet/Mobile toggles own it: the Style tab's older
 * "Hide on this device" field is not offered, the toggles start from what that field already did (`legacyDeviceSeed`), and every
 * write here removes the node's `_style.hidden` (`setNodeDisplay`), so the two can never disagree. Where Studio is off, nothing in
 * this file runs and the Style field works as before.
 */
import { t } from "@/lib/i18n/messages";
import { isEmptyStyle, readStyle, STYLE_SETTING_KEY, withStyleValue, type StyleDevice } from "@/lib/editor/style";
import type { ComponentNode } from "@/lib/templates/document";
import { evaluateDisplay, parseInstant, type DeviceRule, type DisplayRules, type DisplayState, type ScheduleRule } from "@/lib/templates/display-rules";
import { upgradeToDisplayRules } from "@/lib/templates/engine/migrate";
import { manifestMap } from "@/lib/templates/manifests/index";
import type { EditorState } from "@/lib/themes/editor/state";

export type DeviceFlags = { desktop: boolean; tablet: boolean; mobile: boolean };
export const DEVICE_KEYS = ["desktop", "tablet", "mobile"] as const;
export const ALL_DEVICES: DeviceFlags = { desktop: true, tablet: true, mobile: true };

let manifests: ReturnType<typeof manifestMap> | null = null;
/** Whether a section or block type may carry display rules (its manifest's `supports.displayRules`). Unknown types may not. */
export function supportsDisplayRules(kind: "section" | "block", type: string): boolean {
  manifests ??= manifestMap();
  return manifests.get(`${kind}:${type}`)?.supports.displayRules === true;
}

export const scheduleOf = (d: DisplayRules | undefined): ScheduleRule | undefined => d?.rules.find((r): r is ScheduleRule => r.type === "schedule");
export const deviceOf = (d: DisplayRules | undefined): DeviceRule | undefined => d?.rules.find((r): r is DeviceRule => r.type === "device");

/** The device flags the Style tab's per-breakpoint `hidden` already gives a node, with the CSS cascade (tablet -> base, mobile -> tablet -> base). */
export function legacyDeviceSeed(settings: Record<string, unknown> | undefined): DeviceFlags {
  const style = readStyle(settings);
  const hidden = (d: StyleDevice) => style[d]?.hidden;
  const base = hidden("base");
  const tablet = hidden("tablet");
  const mobile = hidden("mobile");
  return { desktop: base !== true, tablet: (tablet ?? base) !== true, mobile: (mobile ?? tablet ?? base) !== true };
}

/** The device flags the panel shows: the node's device rule, else what its old hide setting amounts to. */
export function effectiveDevices(node: Pick<ComponentNode, "display" | "settings">): DeviceFlags {
  const rule = deviceOf(node.display);
  return rule ? { desktop: rule.desktop, tablet: rule.tablet, mobile: rule.mobile } : legacyDeviceSeed(node.settings);
}

/** Rules from the two parts the panel edits. A schedule with neither date and a device rule that shows everywhere are left out; no rule at all is `undefined`. */
export function buildDisplay(schedule: { startsAt?: string; endsAt?: string; timezone?: string } | undefined, devices: DeviceFlags | undefined): DisplayRules | undefined {
  const rules: DisplayRules["rules"] = [];
  if (schedule && (schedule.startsAt !== undefined || schedule.endsAt !== undefined)) {
    const s: ScheduleRule = { type: "schedule" };
    if (schedule.startsAt !== undefined) s.startsAt = schedule.startsAt;
    if (schedule.endsAt !== undefined) s.endsAt = schedule.endsAt;
    if (schedule.timezone !== undefined) s.timezone = schedule.timezone;
    rules.push(s);
  }
  if (devices && !(devices.desktop && devices.tablet && devices.mobile)) rules.push({ type: "device", desktop: devices.desktop, tablet: devices.tablet, mobile: devices.mobile });
  return rules.length ? { v: 1, rules } : undefined;
}

function findNode(node: ComponentNode | undefined, blockId: string): ComponentNode | undefined {
  if (!node) return undefined;
  if (node.blocks?.[blockId]) return node.blocks[blockId];
  for (const child of Object.values(node.blocks ?? {})) {
    const found = findNode(child, blockId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Sets (or, with `undefined`, removes) the display rules of a section or block, and removes the node's old per-device `hidden` style
 * so the new device rule is the only one in force. Returns the same state when the node does not exist.
 */
export function setNodeDisplay(state: EditorState, docId: string, sectionId: string, blockId: string | undefined, display: DisplayRules | undefined): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  const next = structuredClone(current.document) as { sections?: Record<string, ComponentNode> };
  const section = next.sections?.[sectionId];
  const node = blockId ? findNode(section, blockId) : section;
  if (!node) return state;
  if (display === undefined) delete node.display;
  else node.display = display;
  let style = readStyle(node.settings);
  for (const device of ["base", "tablet", "mobile"] as const) style = withStyleValue(style, device, "hidden", undefined);
  const settings = { ...(node.settings ?? {}) };
  if (isEmptyStyle(style)) delete settings[STYLE_SETTING_KEY];
  else settings[STYLE_SETTING_KEY] = style;
  node.settings = settings;
  return { ...state, docs: { ...state.docs, [docId]: { ...current, document: next as unknown as Record<string, unknown> } } };
}

/** Plain-language problems with a node's rules, empty when they are fine. */
export function displayIssues(display: DisplayRules | undefined): string[] {
  const s = scheduleOf(display);
  const issues: string[] = [];
  if (s) {
    const start = s.startsAt === undefined ? null : parseInstant(s.startsAt);
    const end = s.endsAt === undefined ? null : parseInstant(s.endsAt);
    if ((s.startsAt !== undefined && start === null) || (s.endsAt !== undefined && end === null)) issues.push(t("display.error.invalid"));
    else if (start !== null && end !== null && end <= start) issues.push(t("display.schedule.invalidRange"));
  }
  const d = deviceOf(display);
  if (d && !d.desktop && !d.tablet && !d.mobile) issues.push(t("display.device.noneVisible"));
  return issues;
}

// ---- badges -------------------------------------------------------------------------------------------------------

export type DisplayBadge = { kind: "scheduled" | "upcoming" | "expired" | "device"; label: string };

const DEVICE_NAME: Record<(typeof DEVICE_KEYS)[number], string> = { desktop: t("display.device.desktop"), tablet: t("display.device.tablet"), mobile: t("display.device.mobile") };

/** The state of a node's schedule at `nowMs` (the preview clock). */
export const displayState = (display: DisplayRules | undefined, nowMs: number): DisplayState => evaluateDisplay(display, nowMs).state;

/** What the navigator shows beside a section or block: its schedule state and the devices it is hidden on. Empty for a node with no rules. */
export function displayBadges(node: Pick<ComponentNode, "display"> | undefined, nowMs: number): DisplayBadge[] {
  const display = node?.display;
  if (!display) return [];
  const out: DisplayBadge[] = [];
  const state = displayState(display, nowMs);
  if (state === "upcoming") out.push({ kind: "upcoming", label: t("display.badge.upcoming") });
  else if (state === "expired") out.push({ kind: "expired", label: t("display.badge.expired") });
  else if (state === "active") out.push({ kind: "scheduled", label: t("display.badge.scheduled") });
  const device = deviceOf(display);
  const hiddenOn = device ? DEVICE_KEYS.filter((k) => device[k] === false) : [];
  if (hiddenOn.length > 0) out.push({ kind: "device", label: t("display.badge.hiddenOn", { devices: hiddenOn.map((k) => DEVICE_NAME[k]).join(", ") }) });
  return out;
}

// ---- saving -------------------------------------------------------------------------------------------------------

const hasRules = (node: ComponentNode | undefined): boolean => {
  if (!node) return false;
  if (node.display?.rules?.length) return true;
  return Object.values(node.blocks ?? {}).some(hasRules);
};
const anySectionHasRules = (sections: unknown): boolean => typeof sections === "object" && sections !== null && Object.values(sections as Record<string, ComponentNode>).some(hasRules);

/** True when any section or block of the document (or of a page a theme document holds) carries a display rule. */
export function documentHasDisplayRules(doc: Record<string, unknown>): boolean {
  if (anySectionHasRules(doc.sections)) return true;
  const pages = (doc.settings as { pages?: Record<string, { sections?: unknown }> } | undefined)?.pages;
  return typeof pages === "object" && pages !== null && Object.values(pages).some((p) => anySectionHasRules(p?.sections));
}

/**
 * The document as it is sent to the server: a schema 1 document that holds a display rule is upgraded to schema 2 (the existing
 * migration, which also turns old per-device hiding into device rules). Anything else, including a document with no rules, is returned as is.
 */
export function prepareDocumentForSave(doc: Record<string, unknown>): Record<string, unknown> {
  if (doc.schemaVersion !== 1 || !documentHasDisplayRules(doc)) return doc;
  return upgradeToDisplayRules(doc);
}
