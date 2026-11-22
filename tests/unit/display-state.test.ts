import { describe, expect, it } from "vitest";
import { createState, setElementStyle, setSetting } from "@/lib/themes/editor/state";
import {
  buildDisplay, displayBadges, displayIssues, documentHasDisplayRules, effectiveDevices, legacyDeviceSeed, prepareDocumentForSave, setNodeDisplay, supportsDisplayRules,
} from "@/lib/themes/editor/display-state";
import { showsDisplayPanel } from "@/components/themes/editor/display-rules-panel";
import type { DisplayRules } from "@/lib/templates/display-rules";

type Loose = { sections: Record<string, { settings: Record<string, unknown>; display?: DisplayRules; blocks: Record<string, { display?: DisplayRules }> }> };
const node = (type: string, settings: Record<string, unknown> = {}) => ({ type, settings, blocks: {} as Record<string, unknown>, block_order: [] as string[] });
const doc = () => ({ schemaVersion: 1, layout: "classic", sections: { a: { ...node("hero"), blocks: { b: node("heading") }, block_order: ["b"] }, c: node("rich-text") }, order: ["a", "c"] });
const fresh = () => createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: doc() }]);
const sched = (startsAt?: string, endsAt?: string): DisplayRules => ({ v: 1, rules: [{ type: "schedule", startsAt, endsAt }] });
const at = (iso: string) => Date.parse(iso);

describe("setNodeDisplay", () => {
  it("writes and removes display rules on a section and a nested block without touching the input", () => {
    const s = fresh();
    const rules = sched("2026-06-01T00:00:00Z");
    const withSection = setNodeDisplay(s, "p", "a", undefined, rules);
    expect((withSection.docs.p.document as unknown as Loose).sections.a.display).toEqual(rules);
    const withBlock = setNodeDisplay(withSection, "p", "a", "b", rules);
    expect((withBlock.docs.p.document as unknown as Loose).sections.a.blocks.b.display).toEqual(rules);
    expect((s.docs.p.document as unknown as Loose).sections.a.display).toBeUndefined();
    const cleared = setNodeDisplay(withBlock, "p", "a", undefined, undefined);
    expect("display" in (cleared.docs.p.document as unknown as Loose).sections.a).toBe(false);
  });

  it("returns the same state for a node that does not exist", () => {
    const s = fresh();
    expect(setNodeDisplay(s, "p", "nope", undefined, sched("2026-06-01T00:00:00Z"))).toBe(s);
    expect(setNodeDisplay(s, "zz", "a", undefined, undefined)).toBe(s);
  });

  it("removes the old Hide on this device style, so the device toggles are the only control", () => {
    let s = setElementStyle(fresh(), "p", "c", undefined, "mobile", "hidden", true);
    s = setElementStyle(s, "p", "c", undefined, "base", "opacity", 50);
    expect(effectiveDevices({ settings: (s.docs.p.document as unknown as Loose).sections.c.settings })).toEqual({ desktop: true, tablet: true, mobile: false });
    const next = setNodeDisplay(s, "p", "c", undefined, buildDisplay(undefined, { desktop: true, tablet: true, mobile: false }));
    const settings = (next.docs.p.document as unknown as Loose).sections.c.settings as { _style?: Record<string, Record<string, unknown>> };
    expect(settings._style?.mobile).toBeUndefined();
    expect(settings._style?.base).toEqual({ opacity: 50 });
  });
});

describe("device seed and rule building", () => {
  it("follows the CSS cascade of the old hide setting", () => {
    expect(legacyDeviceSeed(undefined)).toEqual({ desktop: true, tablet: true, mobile: true });
    expect(legacyDeviceSeed({ _style: { base: { hidden: true } } })).toEqual({ desktop: false, tablet: false, mobile: false });
    expect(legacyDeviceSeed({ _style: { base: { hidden: true }, tablet: { hidden: false } } })).toEqual({ desktop: false, tablet: true, mobile: true });
    expect(legacyDeviceSeed({ _style: { mobile: { hidden: true } } })).toEqual({ desktop: true, tablet: true, mobile: false });
  });

  it("builds minimal rules: no empty schedule, no all-devices rule, nothing at all when nothing is set", () => {
    expect(buildDisplay(undefined, { desktop: true, tablet: true, mobile: true })).toBeUndefined();
    expect(buildDisplay({}, undefined)).toBeUndefined();
    expect(buildDisplay({ startsAt: "2026-06-01T00:00:00Z", timezone: "Asia/Kolkata" }, { desktop: true, tablet: false, mobile: true })).toEqual({
      v: 1,
      rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z", timezone: "Asia/Kolkata" }, { type: "device", desktop: true, tablet: false, mobile: true }],
    });
  });
});

describe("validation messages", () => {
  it("says in plain words when the end is not after the start, or an instant is invalid, or everything is off", () => {
    expect(displayIssues(sched("2026-06-02T00:00:00Z", "2026-06-01T00:00:00Z"))).toEqual(["The end must be after the start."]);
    expect(displayIssues(sched("2026-06-01T00:00:00Z", "2026-06-01T00:00:00Z"))).toEqual(["The end must be after the start."]);
    expect(displayIssues(sched("not a date"))).toEqual(["Enter a valid date and time."]);
    expect(displayIssues(buildDisplay(undefined, { desktop: false, tablet: false, mobile: false }))).toEqual(["This is hidden on every device."]);
    expect(displayIssues(sched("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z"))).toEqual([]);
    expect(displayIssues(undefined)).toEqual([]);
  });
});

describe("navigator badges", () => {
  const rules: DisplayRules = { v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-07-01T00:00:00Z" }, { type: "device", desktop: true, tablet: false, mobile: false }] };
  it("shows Upcoming before the start, Scheduled while active and Expired after the end, judged by the clock given", () => {
    expect(displayBadges({ display: rules }, at("2026-05-01T00:00:00Z")).map((b) => b.kind)).toEqual(["upcoming", "device"]);
    expect(displayBadges({ display: rules }, at("2026-06-15T00:00:00Z")).map((b) => b.kind)).toEqual(["scheduled", "device"]);
    expect(displayBadges({ display: rules }, at("2026-07-01T00:00:00Z")).map((b) => b.kind)).toEqual(["expired", "device"]);
  });
  it("names the devices a section is hidden on, and shows nothing for a section without rules", () => {
    expect(displayBadges({ display: rules }, at("2026-06-15T00:00:00Z")).find((b) => b.kind === "device")?.label).toBe("Hidden on Tablet, Mobile");
    expect(displayBadges({ display: buildDisplay(undefined, { desktop: false, tablet: true, mobile: true }) }, 0)).toEqual([{ kind: "device", label: "Hidden on Desktop" }]);
    expect(displayBadges({}, 0)).toEqual([]);
    expect(displayBadges(undefined, 0)).toEqual([]);
  });
});

describe("saving at schema 2", () => {
  it("upgrades a schema 1 document that holds a display rule", () => {
    const withRule = setNodeDisplay(fresh(), "p", "a", "b", sched("2026-06-01T00:00:00Z")).docs.p.document;
    expect(documentHasDisplayRules(withRule)).toBe(true);
    const out = prepareDocumentForSave(withRule);
    expect(out.schemaVersion).toBe(2);
    expect((out as unknown as Loose).sections.a.blocks.b.display).toEqual(sched("2026-06-01T00:00:00Z"));
    expect(withRule.schemaVersion).toBe(1); // input untouched
  });
  it("leaves a document with no rules exactly as it is, and a schema 2 document alone", () => {
    const plain = doc();
    expect(prepareDocumentForSave(plain)).toBe(plain);
    expect(prepareDocumentForSave(setSetting(fresh(), "p", "a", undefined, "heading", "x").docs.p.document).schemaVersion).toBe(1);
    const v2 = { ...doc(), schemaVersion: 2 };
    expect(prepareDocumentForSave(v2)).toBe(v2);
  });
  it("sees rules inside the pages of a theme settings document", () => {
    const theme = { schemaVersion: 1, settings: { pages: { cart: { sections: { x: { ...node("rich-text"), display: sched("2026-06-01T00:00:00Z") } } } } } };
    expect(documentHasDisplayRules(theme)).toBe(true);
    expect(prepareDocumentForSave(theme).schemaVersion).toBe(2);
  });
});

describe("gating", () => {
  it("offers the panel only when Studio is on and the manifest supports display rules", () => {
    expect(supportsDisplayRules("section", "hero")).toBe(true);
    expect(supportsDisplayRules("block", "product-title")).toBe(false);
    expect(supportsDisplayRules("section", "no-such-section")).toBe(false);
    expect(showsDisplayPanel(true, "section", "hero")).toBe(true);
    expect(showsDisplayPanel(false, "section", "hero")).toBe(false);
    expect(showsDisplayPanel(true, "block", "product-title")).toBe(false);
  });
});
