import { describe, expect, it } from "vitest";
import { MANIFEST_PERMISSIONS, validateManifest, type ComponentManifest } from "../../lib/templates/manifest";
import { buildFirstPartyManifests, manifestMap } from "../../lib/templates/manifests";
import { getRegistry } from "../../lib/templates/registry/index";
import { checkComponentUnavailable, resolveAvailability } from "../../lib/templates/availability";
import type { ComponentNode } from "../../lib/templates/document";

const base = (): ComponentManifest => structuredClone(buildFirstPartyManifests()[0]);
const node = (type: string, extra: Partial<ComponentNode> = {}): ComponentNode => ({ type, settings: {}, blocks: {}, block_order: [], ...extra });

describe("manifest validator", () => {
  it("accepts a complete manifest", () => {
    expect(validateManifest(base()).ok).toBe(true);
  });

  it("lists the names of missing required fields and never a value", () => {
    const m: Record<string, unknown> = { ...base(), name: "SECRET-NAME-VALUE" };
    delete m.componentVersion;
    delete m.supports;
    delete m.permissions;
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fields).toEqual(expect.arrayContaining(["componentVersion", "supports", "permissions"]));
    expect(r.message).toContain("componentVersion");
    expect(r.message).not.toContain("SECRET-NAME-VALUE");
  });

  it("does not echo an invalid value either", () => {
    const r = validateManifest({ ...base(), componentVersion: "not-semver-SECRET", permissions: ["secrets:read-SECRET"] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fields).toEqual(expect.arrayContaining(["componentVersion", "permissions.0"]));
    expect(JSON.stringify(r)).not.toContain("SECRET");
  });

  it("reports nested field names and unknown fields by name", () => {
    const m = { ...base(), legal: { required: true }, attestation: { required: true }, extraField: 1 };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fields).toEqual(expect.arrayContaining(["legal.featureKey", "attestation.wordingKey", "extraField"]));
  });

  it("rejects a non-object input", () => {
    for (const bad of [null, undefined, 5, "x", []]) expect(validateManifest(bad).ok).toBe(false);
  });

  it("closes the permission set and the availability enum", () => {
    expect(MANIFEST_PERMISSIONS).toEqual(["reviews:read", "products:read", "collections:read", "cart:read", "storefront:read", "media:read"]);
    expect(validateManifest({ ...base(), availability: "soon" }).ok).toBe(false);
    for (const availability of ["available", "unavailable", "deprecated"]) expect(validateManifest({ ...base(), availability }).ok).toBe(true);
  });

  it("requires a semver component version", () => {
    for (const v of ["1", "1.0", "v1.0.0", "01.0.0"]) expect(validateManifest({ ...base(), componentVersion: v }).ok, v).toBe(false);
    expect(validateManifest({ ...base(), componentVersion: "2.10.3-beta.1" }).ok).toBe(true);
  });
});

describe("first-party manifests", () => {
  const registry = getRegistry();
  const manifests = buildFirstPartyManifests();

  it("covers all 20 section types and 23 block types, each valid", () => {
    expect(Object.keys(registry.sections)).toHaveLength(20);
    expect(Object.keys(registry.blocks)).toHaveLength(23);
    expect(manifests).toHaveLength(43);
    for (const m of manifests) expect(validateManifest(m).ok, `${m.kind}:${m.id}`).toBe(true);
    expect(manifests.filter((m) => m.kind === "section").map((m) => m.id)).toEqual(Object.keys(registry.sections));
    expect(manifests.filter((m) => m.kind === "block").map((m) => m.id)).toEqual(Object.keys(registry.blocks));
  });

  it("derives name, accepts and settings reference from the registry", () => {
    for (const m of manifests) {
      const def = m.kind === "section" ? registry.sections[m.id] : registry.blocks[m.id];
      expect(m.name).toBe(def.name);
      expect(m.compatibility.accepts).toEqual(def.accepts ?? []);
      expect(m.compatibility.settingsRef).toBe(`registry:${m.kind}s/${m.id}`);
    }
  });

  it("allowed slots of a block are exactly the parents that accept it", () => {
    for (const m of manifests.filter((x) => x.kind === "block")) {
      const parents = [...Object.values(registry.sections), ...Object.values(registry.blocks)].filter((d) => d.accepts?.includes(m.id)).map((d) => d.type);
      expect([...m.allowedSlots].sort()).toEqual([...new Set(parents)].sort());
    }
    expect(manifests.filter((m) => m.kind === "section").every((m) => m.allowedSlots.join() === "page")).toBe(true);
  });

  // The gated components (countdown, trust badges) are the only ones with a legal or attestation gate; see tests/unit/studio-components.test.ts.
  const GATED = new Set(["countdown", "trust-badges", "trust-badge"]);
  it("are all available with no legal or attestation gate, except the gated components", () => {
    for (const m of manifests) {
      expect(m.availability).toBe("available");
      expect(m.legal.required, m.id).toBe(GATED.has(m.id));
      if (!GATED.has(m.id)) expect(m.attestation.required).toBe(false);
      expect(m.componentVersion).toBe("1.0.0");
    }
  });

  it("marks commerce-critical and structural components non-reusable", () => {
    const get = (kind: string, id: string) => manifests.find((m) => m.kind === kind && m.id === id)!;
    for (const [kind, id] of [["section", "header"], ["section", "footer"], ["section", "main-product"]]) expect(get(kind, id).supports.reusable, id).toBe(false);
    for (const m of manifests.filter((x) => x.kind === "block" && x.category === "Product")) expect(m.supports.reusable, m.id).toBe(false);
    expect(get("section", "hero").supports.reusable).toBe(true);
    expect(get("block", "heading").supports.reusable).toBe(true);
  });

  it("declares products:read for product components and media:read for image settings", () => {
    const get = (id: string, kind = "block") => manifests.find((m) => m.kind === kind && m.id === id)!;
    expect(get("product-price").permissions).toContain("products:read");
    expect(get("main-product", "section").permissions).toEqual(expect.arrayContaining(["products:read", "cart:read"]));
    expect(get("image").permissions).toContain("media:read");
  });

  it("builds a lookup keyed by kind and id", () => {
    const map = manifestMap(manifests);
    expect(map.size).toBe(43);
    expect(map.get("section:hero")?.id).toBe("hero");
  });
});

describe("resolveAvailability truth table", () => {
  const m = (over: Partial<ComponentManifest>): ComponentManifest => ({ ...base(), ...over });
  const gated = { legal: { required: true, featureKey: "feature.x" } };
  const approved = [{ featureKey: "feature.x" }];
  const rows: { name: string; manifest: Partial<ComponentManifest>; approvals: { featureKey: string }[]; live: boolean; available: boolean }[] = [
    { name: "plain available", manifest: {}, approvals: [], live: false, available: true },
    { name: "unavailable", manifest: { availability: "unavailable" }, approvals: [], live: true, available: false },
    { name: "deprecated", manifest: { availability: "deprecated" }, approvals: [], live: true, available: false },
    { name: "legal, no approval", manifest: gated, approvals: [], live: true, available: false },
    { name: "legal, other approval", manifest: gated, approvals: [{ featureKey: "feature.y" }], live: true, available: false },
    { name: "legal, approved", manifest: gated, approvals: approved, live: true, available: true },
    { name: "legal without featureKey", manifest: { legal: { required: true } }, approvals: approved, live: true, available: false },
    { name: "purchase flow, not live", manifest: { requiresPurchaseFlow: true }, approvals: [], live: false, available: false },
    { name: "purchase flow, live", manifest: { requiresPurchaseFlow: true }, approvals: [], live: true, available: true },
    { name: "all gates satisfied", manifest: { ...gated, requiresPurchaseFlow: true }, approvals: approved, live: true, available: true },
    { name: "approved but flow not live", manifest: { ...gated, requiresPurchaseFlow: true }, approvals: approved, live: false, available: false },
    { name: "approved but unavailable", manifest: { ...gated, availability: "unavailable" }, approvals: approved, live: true, available: false },
  ];
  for (const r of rows) {
    it(r.name, () => {
      expect(resolveAvailability(m(r.manifest), { approvals: r.approvals, purchaseFlowLive: r.live }).available).toBe(r.available);
    });
  }

  it("names every reason", () => {
    const r = resolveAvailability(m({ availability: "unavailable", legal: { required: true, featureKey: "f.k" }, requiresPurchaseFlow: true }), { approvals: [], purchaseFlowLive: false });
    expect(r).toEqual({ available: false, reasons: ["manifest_unavailable", "legal_approval_missing", "purchase_flow_not_live"] });
  });

  it("is pure: does not mutate inputs", () => {
    const manifest = Object.freeze(m({}));
    const ctx = Object.freeze({ approvals: Object.freeze([]), purchaseFlowLive: false });
    expect(() => resolveAvailability(manifest, ctx)).not.toThrow();
  });
});

describe("component.unavailable check", () => {
  const all = buildFirstPartyManifests();
  const withGate = (kind: string, id: string): Map<string, ComponentManifest> => {
    const map = manifestMap(all);
    const orig = map.get(`${kind}:${id}`)!;
    map.set(`${kind}:${id}`, { ...orig, legal: { required: true, featureKey: "feature.gate" } });
    return map;
  };
  const doc = {
    order: ["s1", "s2"],
    sections: {
      s1: node("hero", { block_order: ["b1"], blocks: { b1: node("heading") } }),
      s2: node("rich-text"),
    },
  };
  const ctx = { approvals: [], purchaseFlowLive: true };

  it("returns no issues when everything is available", () => {
    expect(checkComponentUnavailable(doc, manifestMap(all), ctx)).toEqual([]);
  });

  it("reports a gated section and a gated nested block, with node ids", () => {
    const map = withGate("section", "hero");
    const issues = checkComponentUnavailable(doc, map, ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: "component.unavailable", severity: "BLOCKER", nodeId: "s1", kind: "section", componentType: "hero", reasons: ["legal_approval_missing"] });
    const blockIssues = checkComponentUnavailable(doc, withGate("block", "heading"), ctx);
    expect(blockIssues.map((i) => i.nodeId)).toEqual(["b1"]);
  });

  it("clears the issue when an approval record exists and skips disabled nodes", () => {
    const map = withGate("section", "hero");
    expect(checkComponentUnavailable(doc, map, { ...ctx, approvals: [{ featureKey: "feature.gate" }] })).toEqual([]);
    const disabled = { ...doc, sections: { ...doc.sections, s1: { ...doc.sections.s1, disabled: true } } };
    expect(checkComponentUnavailable(disabled, map, ctx)).toEqual([]);
  });

  it("ignores node types that have no manifest", () => {
    expect(checkComponentUnavailable({ order: ["x"], sections: { x: node("mystery") } }, manifestMap(all), ctx)).toEqual([]);
  });
});
