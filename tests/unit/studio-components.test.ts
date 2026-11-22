import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: unknown }) => h("a", { href, ...rest }, children as never) };
});

import { CountdownClock } from "../../components/storefront/engine/sections/countdown-clock";
import { isNodeActive, pruneInactiveNodes } from "../../lib/templates/display-prune";
import { MESSAGES, isMessageKey, t } from "../../lib/i18n/messages";
import { resolveAvailability, checkComponentUnavailable } from "../../lib/templates/availability";
import { availabilityOf, studioComponentProblems, unavailableIssuesOf } from "../../lib/templates/component-checks";
import {
  COUNTDOWN_MILESTONES,
  COUNTDOWN_SETTING_IDS,
  clockOffset,
  countdownKeepsAfterEnd,
  countdownTarget,
  formatClock,
  milestoneOf,
  resolveCountdown,
  serverTimeAt,
  splitRemaining,
  validateCountdownSettings,
} from "../../lib/templates/countdown";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import { manifestMap } from "../../lib/templates/manifests";
import { getRegistry } from "../../lib/templates/registry/index";
import { NO_FEATURES, approvalsFromFeatures, parseStudioFeatures } from "../../lib/templates/studio-features";
import {
  BADGE_ICONS,
  BADGE_LIMITS,
  PRESET_BADGES,
  badgeExcludedClaim,
  presetMessageKey,
  safeBadgeLink,
  validateBadgeSettings,
} from "../../lib/templates/trust-badges";
import { attestationFor, badgeFileProblem, parseFinalized, parseUploadTarget, parseWording } from "../../lib/studio/badge-upload";
import { renderSample } from "./fixtures/schema1-render-samples";

const manifests = manifestMap();
const get = (kind: "section" | "block", id: string) => manifests.get(`${kind}:${id}`)!;
const CTX = { purchaseFlowLive: true };

const node = (type: string, settings: Record<string, unknown> = {}, blocks: Record<string, ComponentNode> = {}, extra: Partial<ComponentNode> = {}): ComponentNode => ({ type, settings, blocks, block_order: Object.keys(blocks), ...extra });
const doc = (sections: Record<string, ComponentNode>): TemplateDocument => ({ schemaVersion: 2, layout: "classic", sections, order: Object.keys(sections) });

const T0 = Date.parse("2026-12-01T09:00:00Z");
const sched = (endsAt: string, startsAt?: string) => ({ v: 1 as const, rules: [{ type: "schedule" as const, ...(startsAt ? { startsAt } : {}), endsAt }] });

describe("availability resolver: countdown and trust badges", () => {
  const rows: [string, "section" | "block", string, string][] = [
    ["countdown", "section", "countdown", "countdown"],
    ["trust-badges", "section", "trust-badges", "trust_badges"],
    ["trust-badge", "block", "trust-badge", "trust_badges"],
  ];
  for (const [name, kind, id, featureKey] of rows) {
    it(`${name}: manifest is gated by feature key ${featureKey}`, () => {
      const m = get(kind, id);
      expect(m.availability).toBe("available");
      expect(m.legal).toEqual({ required: true, featureKey });
      expect(m.supports.displayRules).toBe(true);
      expect(m.supports.reusable).toBe(true);
    });
    it(`${name}: unavailable without an approval, available with it, unavailable with another`, () => {
      const m = get(kind, id);
      expect(resolveAvailability(m, { approvals: [], ...CTX })).toEqual({ available: false, reasons: ["legal_approval_missing"] });
      expect(resolveAvailability(m, { approvals: [{ featureKey: "something_else" }], ...CTX })).toEqual({ available: false, reasons: ["legal_approval_missing"] });
      expect(resolveAvailability(m, { approvals: [{ featureKey }], ...CTX })).toEqual({ available: true });
    });
  }

  it("uploaded marks need an attestation (wording badge_upload)", () => {
    for (const [kind, id] of [["section", "trust-badges"], ["block", "trust-badge"]] as const) expect(get(kind, id).attestation).toEqual({ required: true, wordingKey: "badge_upload" });
    expect(get("section", "countdown").attestation.required).toBe(false);
  });

  it("with no Studio features both components are unavailable by default", () => {
    for (const [kind, id] of [["section", "countdown"], ["section", "trust-badges"], ["block", "trust-badge"]] as const) {
      expect(availabilityOf(kind, id, undefined).available).toBe(false);
      expect(availabilityOf(kind, id, NO_FEATURES).available).toBe(false);
    }
    expect(availabilityOf("section", "hero", undefined).available).toBe(true);
  });

  it("badge_upload available maps to the trust_badges approval; countdown has no approval to map", () => {
    const features = parseStudioFeatures({ badge_upload: "available", review_import: "available" });
    expect(approvalsFromFeatures(features)).toEqual([{ featureKey: "trust_badges" }]);
    expect(availabilityOf("section", "trust-badges", features).available).toBe(true);
    expect(availabilityOf("block", "trust-badge", features).available).toBe(true);
    expect(availabilityOf("section", "countdown", features).available).toBe(false);
  });

  it("absent or unknown feature values read as unavailable", () => {
    expect(parseStudioFeatures(undefined)).toEqual(NO_FEATURES);
    expect(parseStudioFeatures({ badge_upload: "enabled" })).toEqual(NO_FEATURES);
    expect(parseStudioFeatures("available")).toEqual(NO_FEATURES);
  });

  it("publishing a document that contains one is flagged by checkComponentUnavailable", () => {
    const d = doc({ c: node("countdown", {}), b: node("trust-badges", {}, { x: node("trust-badge", { kind: "preset", preset: "free-shipping" }) }), h: node("hero", {}) });
    const issues = checkComponentUnavailable(d, manifests, { approvals: [], purchaseFlowLive: false });
    expect(issues.map((i) => `${i.kind}:${i.componentType}`).sort()).toEqual(["block:trust-badge", "section:countdown", "section:trust-badges"]);
    expect(issues.every((i) => i.severity === "BLOCKER" && i.reasons.includes("legal_approval_missing"))).toBe(true);
    // The editor helper reads the features of the store.
    expect(unavailableIssuesOf(d, NO_FEATURES)).toHaveLength(3);
    expect(unavailableIssuesOf(d, parseStudioFeatures({ badge_upload: "available" })).map((i) => i.componentType)).toEqual(["countdown"]);
    expect(unavailableIssuesOf(null, NO_FEATURES)).toEqual([]);
  });
});

describe("countdown logic", () => {
  it("splits and formats the remaining time (rounding up to the next second)", () => {
    expect(splitRemaining(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(splitRemaining(1)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(splitRemaining(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(formatClock(90_061_000)).toBe("1d 01:01:01");
    expect(formatClock(3_661_000)).toBe("01:01:01");
  });

  it("milestones: more than a day, a day, an hour, ten minutes, a minute, ended", () => {
    expect(COUNTDOWN_MILESTONES).toEqual(["long", "day", "hour", "tenMinutes", "minute", "ended"]);
    expect(milestoneOf(86_400_001)).toBe("long");
    expect(milestoneOf(86_400_000)).toBe("day");
    expect(milestoneOf(3_600_001)).toBe("day");
    expect(milestoneOf(3_600_000)).toBe("hour");
    expect(milestoneOf(600_000)).toBe("tenMinutes");
    expect(milestoneOf(60_000)).toBe("minute");
    expect(milestoneOf(1)).toBe("minute");
    expect(milestoneOf(0)).toBe("ended");
    expect(milestoneOf(Number.NaN)).toBe("ended");
  });

  it("every milestone has an English announcement in the catalogue", () => {
    for (const m of COUNTDOWN_MILESTONES) expect(isMessageKey(`countdown.announce.${m}`), m).toBe(true);
  });

  it("computes the clock offset once and applies it", () => {
    const offset = clockOffset(1_000_000, 940_000);
    expect(offset).toBe(60_000);
    expect(serverTimeAt(950_000, offset)).toBe(1_010_000);
  });

  it("target: the section's own schedule end, or a fixed ISO instant", () => {
    const end = "2026-12-02T09:00:00Z";
    expect(countdownTarget(node("countdown", { targetMode: "schedule-end" }, {}, { display: sched(end) }))).toBe(Date.parse(end));
    expect(countdownTarget(node("countdown", {}, {}, { display: sched(end) }))).toBe(Date.parse(end));
    expect(countdownTarget(node("countdown", { targetMode: "schedule-end" }))).toBeNull();
    expect(countdownTarget(node("countdown", { targetMode: "fixed", fixedAt: "2026-12-05T10:00:00+05:30" }, {}, { display: sched(end) }))).toBe(Date.parse("2026-12-05T04:30:00Z"));
    expect(countdownTarget(node("countdown", { targetMode: "fixed", fixedAt: "tomorrow" }))).toBeNull();
    expect(countdownTarget(node("countdown", { targetMode: "fixed", fixedAt: "2026-02-31T00:00:00Z" }))).toBeNull();
  });

  it("end behaviours: running, hide, message, unset", () => {
    const fixed = (endBehavior: string, endMessage = "") => node("countdown", { targetMode: "fixed", fixedAt: "2026-12-01T10:00:00Z", endBehavior, endMessage });
    expect(resolveCountdown(fixed("hide"), T0)).toMatchObject({ kind: "running", remaining: 3_600_000 });
    expect(resolveCountdown(fixed("hide"), T0 + 3_600_000)).toEqual({ kind: "hidden" });
    expect(resolveCountdown(fixed("message", "Sale over"), T0 + 3_600_000)).toEqual({ kind: "ended", message: "Sale over" });
    expect(resolveCountdown(fixed("message", "  "), T0 + 3_600_000)).toEqual({ kind: "hidden" });
    expect(resolveCountdown(node("countdown", {}), T0)).toEqual({ kind: "unset" });
  });

  it("settings schema has no evergreen, per-visitor or reset option", () => {
    const section = getRegistry().sections.countdown;
    const ids = section.settings.map((s) => s.id);
    expect(ids).toEqual([...COUNTDOWN_SETTING_IDS]);
    expect(ids).toEqual(["heading", "targetMode", "fixedAt", "endBehavior", "endMessage"]);
    const everything = JSON.stringify(section.settings).toLowerCase();
    for (const banned of ["evergreen", "per-visitor", "pervisitor", "visitor", "reset", "rolling", "restart", "cookie", "session", "duration", "loop", "repeat"]) expect(everything, banned).not.toContain(banned);
    expect(section.settings.find((s) => s.id === "targetMode")?.options?.map((o) => o.value)).toEqual(["schedule-end", "fixed"]);
    expect(section.settings.find((s) => s.id === "endBehavior")?.options?.map((o) => o.value)).toEqual(["hide", "message"]);
    // An evergreen mode smuggled into a document is rejected by validation, not silently honoured.
    expect(validateCountdownSettings({ targetMode: "evergreen" })).toHaveProperty("targetMode");
  });

  it("validates settings", () => {
    expect(validateCountdownSettings({})).toEqual({});
    expect(validateCountdownSettings({ targetMode: "fixed", fixedAt: "soon" })).toHaveProperty("fixedAt");
    expect(validateCountdownSettings({ endBehavior: "message", endMessage: "" })).toHaveProperty("endMessage");
    expect(validateCountdownSettings({ endBehavior: "message", endMessage: "x".repeat(161) })).toHaveProperty("endMessage");
    expect(validateCountdownSettings({ endBehavior: "restart" })).toHaveProperty("endBehavior");
  });

  it("a schedule-end countdown with a message stays after its schedule ends; others are pruned as before", () => {
    const keep = node("countdown", { targetMode: "schedule-end", endBehavior: "message", endMessage: "Done" }, {}, { display: sched("2026-12-01T08:00:00Z") });
    const drop = node("countdown", { targetMode: "schedule-end", endBehavior: "hide" }, {}, { display: sched("2026-12-01T08:00:00Z") });
    expect(countdownKeepsAfterEnd(keep)).toBe(true);
    expect(countdownKeepsAfterEnd(drop)).toBe(false);
    expect(isNodeActive(keep, T0)).toBe(true);
    expect(isNodeActive(drop, T0)).toBe(false);
    // Only the END is lifted: a start in the future still hides it.
    const future = node("countdown", { targetMode: "schedule-end", endBehavior: "message", endMessage: "Done" }, {}, { display: sched("2026-12-09T08:00:00Z", "2026-12-08T08:00:00Z") });
    expect(isNodeActive(future, T0)).toBe(false);
    expect(pruneInactiveNodes(doc({ k: keep, d: drop }), T0).order).toEqual(["k"]);
  });
});

describe("countdown rendering", () => {
  const fixed = (extra: Record<string, unknown> = {}, more: Partial<ComponentNode> = {}) => node("countdown", { heading: "Sale ends in", targetMode: "fixed", fixedAt: "2026-12-01T10:00:00Z", endBehavior: "hide", ...extra }, {}, more);

  it("renders from the SERVER clock: same inputs give identical markup (no hydration mismatch)", () => {
    const d = doc({ c: fixed() });
    const a = renderSample(d, "public", { serverNow: T0 });
    const b = renderSample(d, "public", { serverNow: T0 });
    expect(a).toBe(b);
    expect(a).toContain("Sale ends in");
    expect(a).toContain(">01<"); // one hour left: hours "01"
    expect(a).toContain(">00<");
    // The browser clock is never read for the first render: a different server time gives different text.
    expect(renderSample(d, "public", { serverNow: T0 + 1_800_000 })).toContain(">30<");
  });

  it("the live digits are aria-hidden and one polite visually hidden announcement carries the milestone text", () => {
    const html = renderSample(doc({ c: fixed() }), "public", { serverNow: T0 });
    expect(html).toMatch(/<time[^>]*aria-hidden="true"/);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('aria-live="polite"');
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain(t("countdown.announce.hour"));
    expect(renderSample(doc({ c: fixed() }), "public", { serverNow: T0 - 3 * 86_400_000 })).toContain(t("countdown.announce.long"));
  });

  it("does not animate (reduced motion is honoured by having no animation or transition)", () => {
    const html = renderSample(doc({ c: fixed() }), "public", { serverNow: T0 });
    expect(html).not.toMatch(/animate-|transition|motion-safe|@keyframes/);
  });

  it("the client component's first render is a pure function of its props", () => {
    const props = { target: Date.parse("2026-12-01T10:00:00Z"), serverNow: T0, heading: "H", endBehavior: "hide" as const, endMessage: "" };
    expect(renderToStaticMarkup(createElement(CountdownClock, props))).toBe(renderToStaticMarkup(createElement(CountdownClock, props)));
  });

  it("at zero: hide omits the section, message shows the end message", () => {
    const after = T0 + 3_600_000;
    expect(renderSample(doc({ c: fixed() }), "public", { serverNow: after })).not.toContain("Sale ends in");
    expect(renderSample(doc({ c: fixed() }), "public", { serverNow: after })).not.toContain("<section");
    const html = renderSample(doc({ c: fixed({ endBehavior: "message", endMessage: "The sale has ended" }) }), "public", { serverNow: after });
    expect(html).toContain("The sale has ended");
    expect(html).toContain('data-sf-protected="countdown-end-message"');
    expect(html).not.toContain("Sale ends in");
  });

  it("the end message is protected: _style (hidden or restyled) and device rules do not wrap or hide it", () => {
    const style = { base: { hidden: true, color: "#ffffff", opacity: 0 } };
    const hostile = fixed({ endBehavior: "message", endMessage: "PROTECTED-END", _style: style }, { display: { v: 1, rules: [{ type: "device", desktop: false, tablet: false, mobile: false }] } });
    const after = T0 + 3_600_000;
    const ended = renderSample(doc({ c: hostile }), "public", { serverNow: after });
    expect(ended).toContain("PROTECTED-END");
    // The page stylesheet may still hold the rule, but no element carries the hook it targets.
    expect(ended).not.toMatch(/<[a-z]+[^>]*data-sf-ov/);
    expect(ended).not.toContain("data-sf-hide");
    expect(ended).not.toContain("max-[767px]:hidden");
    // While running, the same section is wrapped by its style and device rule, as any section is.
    const running = renderSample(doc({ c: hostile }), "public", { serverNow: T0 });
    expect(running).toMatch(/<[a-z]+[^>]*data-sf-ov/);
    expect(running).toContain("data-sf-hide");
  });

  it("a schedule-end countdown with a message shows the message after its own schedule ended", () => {
    const c = node("countdown", { targetMode: "schedule-end", endBehavior: "message", endMessage: "Over now" }, {}, { display: sched("2026-12-01T08:00:00Z") });
    expect(renderSample(doc({ c }), "public", { serverNow: T0 })).toContain("Over now");
    const hide = node("countdown", { targetMode: "schedule-end", endBehavior: "hide" }, {}, { display: sched("2026-12-01T08:00:00Z") });
    expect(renderSample(doc({ c: hide }), "public", { serverNow: T0 })).not.toContain("<section");
  });

  it("a countdown with no target shows nothing publicly and a hint in the editor preview", () => {
    const c = node("countdown", {});
    expect(renderSample(doc({ c }), "public", { serverNow: T0 })).not.toContain("<section");
    expect(renderSample(doc({ c }), "preview")).toContain(t("countdown.editor.noTarget"));
  });
});

describe("badgeExcludedClaim", () => {
  const claims = ["Verified Seller", "verified  seller", "Trusted Store", "TRUSTED STORE", "Secure checkout", "secure-checkout", "Secure Payments", "Secure payment", "Certified organic", "ISO certification", "We accept Visa", "MasterCard", "Pay by UPI", "Razorpay", "powered by PayPal", "Apple Pay", "s" + String.fromCharCode(0x200b) + "ecure checkout"];
  for (const c of claims) it(`flags "${c}"`, () => expect(badgeExcludedClaim(c), c).not.toBeNull());
  const fine = ["Free shipping", "Easy returns", "Secure packaging", "Quality checked", "Handmade in India", "Ships in 2 days", "Equipment care", "Supi", "Visage cream", "Ships worldwide"];
  for (const f of fine) it(`allows "${f}"`, () => expect(badgeExcludedClaim(f), f).toBeNull());
  it("is not fooled by non-strings", () => {
    expect(badgeExcludedClaim(undefined)).toBeNull();
    expect(badgeExcludedClaim(5)).toBeNull();
  });
  it("no preset id or label makes an excluded claim", () => {
    for (const p of PRESET_BADGES) {
      expect(badgeExcludedClaim(p.replace(/-/g, " ")), p).toBeNull();
      expect(badgeExcludedClaim(t(presetMessageKey(p))), p).toBeNull();
    }
  });
});

describe("trust badge validation", () => {
  const ok = { kind: "preset", preset: "free-shipping" };
  it("accepts good presets, text badges and uploaded marks", () => {
    expect(validateBadgeSettings(ok)).toEqual({});
    expect(validateBadgeSettings({ kind: "text", text: "Handmade in Jaipur", icon: "heart" })).toEqual({});
    expect(validateBadgeSettings({ kind: "upload", markAssetId: "a1", markPath: "t/store/a.png", markAlt: "Our workshop stamp" })).toEqual({});
  });
  it("the preset list is closed", () => {
    expect(PRESET_BADGES).toEqual(["free-shipping", "easy-returns", "secure-packaging", "quality-checked"]);
    for (const banned of ["verified", "trusted", "shield", "certif", "secure-payment", "visa", "mastercard", "upi", "razorpay"]) expect(PRESET_BADGES.join(" ")).not.toContain(banned);
    expect(validateBadgeSettings({ kind: "preset", preset: "verified-seller" })).toHaveProperty("preset");
    expect(validateBadgeSettings({ kind: "preset" })).toHaveProperty("preset");
    expect(validateBadgeSettings({ kind: "carousel" })).toHaveProperty("kind");
  });
  it("rejects excluded claims in text badges", () => {
    for (const text of ["Verified seller", "Trusted store", "Secure checkout", "Certified", "Visa accepted", "UPI"]) expect(validateBadgeSettings({ kind: "text", text, icon: "star" }), text).toHaveProperty("text");
    expect(validateBadgeSettings({ kind: "text", text: "", icon: "star" })).toHaveProperty("text");
    expect(validateBadgeSettings({ kind: "text", text: "x".repeat(BADGE_LIMITS.text + 1), icon: "star" })).toHaveProperty("text");
  });
  it("icons come from a closed list of about twelve", () => {
    expect(BADGE_ICONS).toHaveLength(12);
    const words = BADGE_ICONS.flatMap((i) => i.split("-"));
    for (const banned of ["shield", "lock", "badge", "check", "award", "verified"]) expect(words, banned).not.toContain(banned);
    expect(validateBadgeSettings({ kind: "text", text: "Hi", icon: "shield-check" })).toHaveProperty("icon");
    expect(validateBadgeSettings({ kind: "text", text: "Hi" })).toHaveProperty("icon");
    for (const icon of BADGE_ICONS) expect(validateBadgeSettings({ kind: "text", text: "Hi", icon })).toEqual({});
  });
  it("an uploaded mark needs an asset id, a path and alt text", () => {
    const mark = { kind: "upload", markAssetId: "a1", markPath: "t/store/a.png", markAlt: "Stamp" };
    expect(validateBadgeSettings({ ...mark, markAlt: "" })).toHaveProperty("markAlt");
    expect(validateBadgeSettings({ ...mark, markAlt: "   " })).toHaveProperty("markAlt");
    expect(validateBadgeSettings({ ...mark, markAssetId: "" })).toHaveProperty("markAssetId");
    expect(validateBadgeSettings({ ...mark, markPath: "" })).toHaveProperty("markPath");
    expect(validateBadgeSettings({ ...mark, markAlt: "Verified seller seal" })).toHaveProperty("markAlt");
    expect(validateBadgeSettings({ kind: "upload" })).toMatchObject({ markAssetId: expect.any(String), markPath: expect.any(String), markAlt: expect.any(String) });
  });
  it("links: internal paths and https only", () => {
    for (const link of ["/returns", "/pages/shipping", "https://example.com/policy"]) {
      expect(safeBadgeLink(link), link).not.toBeNull();
      expect(validateBadgeSettings({ ...ok, link }), link).toEqual({});
    }
    for (const link of ["javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "data:text/html,<b>x</b>", "http://example.com", "//evil.example", "/\\evil.example", "mailto:a@b.co", "ftp://x.example", "https://user:pw@example.com", "vbscript:x", "example.com", "#top", "https://"]) {
      expect(safeBadgeLink(link), link).toBeNull();
      expect(validateBadgeSettings({ ...ok, link }), link).toHaveProperty("link");
    }
    expect(validateBadgeSettings({ ...ok, link: "" })).toEqual({});
  });
  it("finds problems anywhere in a document by path", () => {
    const d = doc({
      s: node("trust-badges", {}, { b: node("trust-badge", { kind: "text", text: "Trusted store", icon: "star", link: "javascript:x" }) }),
      c: node("countdown", { targetMode: "fixed", fixedAt: "nope" }),
    });
    expect(Object.keys(studioComponentProblems(d)).sort()).toEqual(["sections.c.settings.fixedAt", "sections.s.blocks.b.settings.link", "sections.s.blocks.b.settings.text"]);
    expect(studioComponentProblems({})).toEqual({});
  });
  it("descriptors: the registry lists the closed presets and icons only", () => {
    const block = getRegistry().blocks["trust-badge"];
    expect(block.settings.find((s) => s.id === "preset")?.options?.map((o) => o.value)).toEqual([...PRESET_BADGES]);
    expect(block.settings.find((s) => s.id === "icon")?.options?.map((o) => o.value)).toEqual([...BADGE_ICONS]);
    expect(getRegistry().sections["trust-badges"].accepts).toEqual(["trust-badge"]);
  });
});

describe("trust badge rendering", () => {
  const badges = (blocks: Record<string, ComponentNode>, extra: Record<string, unknown> = {}) => doc({ s: node("trust-badges", { heading: "Why shop with us", ...extra }, blocks) });
  it("renders presets, text badges, links and the disclaimer", () => {
    const html = renderSample(
      badges({
        a: node("trust-badge", { kind: "preset", preset: "free-shipping" }),
        b: node("trust-badge", { kind: "text", text: "Handmade in Jaipur", icon: "heart", link: "/about" }),
        c: node("trust-badge", { kind: "text", text: "Fair pricing", icon: "star", link: "https://example.com/p" }),
      }),
    );
    expect(html).toContain("Why shop with us");
    expect(html).toContain("Free shipping");
    expect(html).toContain("Handmade in Jaipur");
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="https://example.com/p"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(t("trustBadges.disclaimer"));
    expect(html).toContain("Badge claims are statements by the store owner. Store Forge does not verify them.");
  });
  it("renders an uploaded mark with its alt text", () => {
    const html = renderSample(badges({ a: node("trust-badge", { kind: "upload", markAssetId: "a1", markPath: "https://cdn.example.com/m.png", markAlt: "Hand stamp" }) }));
    expect(html).toContain('alt="Hand stamp"');
    expect(html).toContain("cdn.example.com/m.png");
  });
  it("does not draw an invalid badge publicly (excluded claim, bad link, missing alt)", () => {
    const html = renderSample(
      badges({
        a: node("trust-badge", { kind: "text", text: "Verified seller", icon: "star" }),
        b: node("trust-badge", { kind: "preset", preset: "free-shipping", link: "javascript:alert(1)" }),
        c: node("trust-badge", { kind: "upload", markAssetId: "a1", markPath: "https://cdn.example.com/m.png", markAlt: "" }),
      }),
    );
    expect(html).not.toContain("Verified seller");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("cdn.example.com/m.png");
    expect(html).not.toContain("Free shipping");
    expect(renderSample(badges({ a: node("trust-badge", { kind: "text", text: "Verified seller", icon: "star" }) }), "preview")).toContain("Finish this badge");
  });
  it("the disclaimer cannot be restyled away by a block style override", () => {
    const html = renderSample(badges({ a: node("trust-badge", { kind: "preset", preset: "easy-returns", _style: { base: { hidden: true } } }) }));
    expect(html).toContain('data-sf-protected="trust-badges-disclaimer"');
    expect(html).toContain(t("trustBadges.disclaimer"));
  });
});

describe("message catalogue and manifest keys", () => {
  it("has the new English keys", () => {
    for (const key of ["countdown.announce.long", "countdown.announce.day", "countdown.announce.hour", "countdown.announce.tenMinutes", "countdown.announce.minute", "countdown.announce.ended", "trustBadges.disclaimer", "trustBadges.preset.freeShipping", "trustBadges.preset.easyReturns", "trustBadges.preset.securePackaging", "trustBadges.preset.qualityChecked", "component.unavailable.reason.legal"]) {
      expect(isMessageKey(key), key).toBe(true);
      expect(MESSAGES[key as keyof typeof MESSAGES].length).toBeGreaterThan(0);
    }
    expect(t("trustBadges.disclaimer")).toBe("Badge claims are statements by the store owner. Store Forge does not verify them.");
  });
  it("every message key a manifest lists exists in the catalogue", () => {
    for (const m of manifests.values()) for (const key of m.messageKeys) expect(isMessageKey(key), `${m.id}: ${key}`).toBe(true);
  });
});

describe("badge upload helpers", () => {
  it("reads the wording, the upload target and the finalized asset defensively", () => {
    expect(parseWording({ key: "badge_upload", version: 3, text: "I own this image." })).toEqual({ key: "badge_upload", version: "3", text: "I own this image." });
    expect(parseWording({ wordingVersion: "v2", wording: "W" })).toEqual({ key: "badge_upload", version: "v2", text: "W" });
    expect(parseWording({ text: "no version" })).toBeNull();
    expect(parseWording(null)).toBeNull();
    expect(parseUploadTarget({ asset: { id: "a1", path: "t/store/a.png" }, upload: { signedUrl: "https://s.example/u" } })).toEqual({ assetId: "a1", path: "t/store/a.png", uploadUrl: "https://s.example/u" });
    expect(parseUploadTarget({ id: "a1", path: "p", uploadUrl: "https://s.example/u" })).toMatchObject({ assetId: "a1" });
    expect(parseUploadTarget({ id: "a1" })).toBeNull();
    expect(parseFinalized({ id: "a1" }, { assetId: "a1", path: "p" })).toEqual({ assetId: "a1", path: "p" });
    expect(parseFinalized(undefined, { assetId: "a1", path: "p" })).toEqual({ assetId: "a1", path: "p" });
  });
  it("builds the attestation record with the wording shown", () => {
    expect(attestationFor({ version: "3" }, "a1")).toEqual({ type: "badge_upload", wordingKey: "badge_upload", wordingVersion: 3, assetId: "a1" });
    expect(attestationFor({ version: "v2" }, "a1").wordingVersion).toBe("v2");
  });
  it("checks the file before any request", () => {
    expect(badgeFileProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(badgeFileProblem({ type: "image/svg+xml", size: 1000 })).not.toBeNull();
    expect(badgeFileProblem({ type: "image/png", size: 2 * 1024 * 1024 })).not.toBeNull();
    expect(badgeFileProblem({ type: "image/png", size: 0 })).not.toBeNull();
  });
});
