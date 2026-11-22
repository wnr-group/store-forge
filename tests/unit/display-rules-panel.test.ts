import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});

import { DisplayRulesPanel } from "@/components/themes/editor/display-rules-panel";
import { PreviewAsOf } from "@/components/themes/editor/preview-controls";
import { SectionsPanel } from "@/components/themes/editor/sections-panel";
import { SettingsPanel } from "@/components/themes/editor/settings-panel";
import "@/lib/editor/adapters";
import { adapterForLook } from "@/lib/editor/adapter";
import type { DisplayRules } from "@/lib/templates/display-rules";
import { createState, select } from "@/lib/themes/editor/state";

const noop = () => {};
const sched: DisplayRules = { v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T03:30:00Z", endsAt: "2026-07-01T03:30:00Z" }, { type: "device", desktop: true, tablet: false, mobile: true }] };
const NOW = Date.parse("2026-06-15T00:00:00Z");

const panel = (display: DisplayRules | undefined, over: Partial<Parameters<typeof DisplayRulesPanel>[0]> = {}) =>
  renderToStaticMarkup(createElement(DisplayRulesPanel, { node: { display, settings: {} }, disabled: false, timezone: "Asia/Kolkata", nowMs: NOW, onChange: noop, ...over }));

describe("display rules panel markup", () => {
  it("shows the schedule on the store clock, the time zone, the state chip, the device toggles and the footnote", () => {
    const html = panel(sched);
    expect(html).toContain("When to show");
    expect(html).toContain('value="2026-06-01T09:00"'); // 03:30Z on the Kolkata clock
    expect(html).toContain('value="2026-07-01T09:00"');
    expect(html).toContain("Asia/Kolkata");
    expect(html).toContain('data-display-state="active"');
    expect(html).toContain(">Active<");
    for (const d of ["Desktop", "Tablet", "Mobile"]) expect(html).toContain(d);
    expect(html).toContain("Hiding on a device is a visual setting. Content may still be sent to the browser.");
    expect(html).not.toContain("hidden on every device");
  });

  it("computes the chip against the preview clock: Always, Upcoming, Expired", () => {
    expect(panel(undefined)).toContain('data-display-state="always"');
    expect(panel(sched, { nowMs: Date.parse("2026-05-01T00:00:00Z") })).toContain(">Upcoming<");
    expect(panel(sched, { nowMs: Date.parse("2026-08-01T00:00:00Z") })).toContain(">Expired<");
  });

  it("falls back to the label store timezone when the store zone is unknown", () => {
    expect(panel(undefined, { timezone: null })).toContain("store timezone");
  });

  it("warns when all three devices are off, and explains an end that is not after the start", () => {
    const off: DisplayRules = { v: 1, rules: [{ type: "device", desktop: false, tablet: false, mobile: false }] };
    expect(panel(off)).toContain("This is hidden on every device.");
    const backwards: DisplayRules = { v: 1, rules: [{ type: "schedule", startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-06-01T00:00:00Z" }] };
    expect(panel(backwards)).toContain("The end must be after the start.");
  });

  it("starts the toggles from the old Hide on this device setting when there is no device rule yet", () => {
    const html = renderToStaticMarkup(createElement(DisplayRulesPanel, { node: { settings: { _style: { mobile: { hidden: true } } } }, disabled: false, timezone: "UTC", nowMs: NOW, onChange: noop }));
    expect(html.match(/aria-checked="false"/g) ?? []).toHaveLength(1);
    expect(html.match(/aria-checked="true"/g) ?? []).toHaveLength(2);
  });
});

describe("gating in the inspector", () => {
  const node = (type: string, settings: Record<string, unknown> = {}) => ({ type, settings, blocks: {}, block_order: [] as string[] });
  const doc = { schemaVersion: 1, layout: "classic", sections: { a: { ...node("hero", { _style: { base: { opacity: 80 } } }), blocks: { t: node("product-title") }, block_order: ["t"] } }, order: ["a"] };
  const stateFor = (blockId?: string) => select(createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: doc }]), { docId: "p", sectionId: "a", blockId });
  const render = (studioEnabled: boolean, blockId?: string) =>
    renderToStaticMarkup(
      createElement(SettingsPanel, {
        state: stateFor(blockId), disabled: false, problems: {}, onSetting: noop, onThemeSetting: noop, themeDocId: null, mode: "section", adapter: adapterForLook(undefined), styleDevice: "base",
        onStyle: noop, onResetStyle: noop, onSelectParent: noop, focusSetting: null, onFocusConsumed: noop, clickedText: null, onText: noop, onTextStyle: noop,
        cardContext: { look: undefined, descriptionDefault: false }, studioEnabled, timezone: "UTC", nowMs: NOW, onDisplay: noop,
      }),
    );

  it("does not show When to show where Studio is off", () => {
    expect(render(false)).not.toContain("When to show");
  });
  it("shows it for a section that supports display rules where Studio is on", () => {
    expect(render(true)).toContain("When to show");
  });
  it("does not show it for a block whose manifest does not support display rules", () => {
    expect(render(true, "t")).not.toContain("When to show");
  });
});

describe("navigator badges markup", () => {
  const node = (type: string, display?: DisplayRules) => ({ type, settings: {}, blocks: {}, block_order: [] as string[], ...(display ? { display } : {}) });
  const doc = { schemaVersion: 1, layout: "classic", sections: { a: node("hero", sched), b: node("rich-text") }, order: ["a", "b"] };
  const render = (badgeNowMs: number | null) =>
    renderToStaticMarkup(
      createElement(SectionsPanel, {
        state: createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: doc }]),
        groupIds: { announcement: null, header: null, footer: null }, pageKind: "index", disabled: false, adapter: adapterForLook(undefined), cardContext: { look: undefined, descriptionDefault: false },
        actions: { select: noop, toggle: noop, duplicate: noop, remove: noop, move: noop, add: noop, addBlock: noop, removeBlock: noop, moveBlock: noop, setSetting: noop },
        badgeNowMs,
      }),
    );

  it("marks scheduled and hidden-on-device sections, and only those", () => {
    const html = render(NOW);
    expect(html).toContain('data-badge="scheduled"');
    expect(html).toContain("Hidden on Tablet");
    expect(html.match(/data-display-badges/g)).toHaveLength(1);
    expect(render(Date.parse("2026-05-01T00:00:00Z"))).toContain('data-badge="upcoming"');
    expect(render(Date.parse("2026-08-01T00:00:00Z"))).toContain('data-badge="expired"');
  });
  it("shows no badges where Studio is off", () => {
    expect(render(null)).not.toContain("data-display-badges");
  });
});

describe("Preview as of", () => {
  it("shows the chosen instant on the store clock and offers a way back to now", () => {
    const html = renderToStaticMarkup(createElement(PreviewAsOf, { value: "2026-06-01T03:30:00Z", timezone: "Asia/Kolkata", onChange: noop }));
    expect(html).toContain("Preview as of...");
    expect(html).toContain('value="2026-06-01T09:00"');
    expect(html).toContain("Show now");
    expect(renderToStaticMarkup(createElement(PreviewAsOf, { value: null, timezone: "UTC", onChange: noop }))).not.toContain("Show now");
  });
});
