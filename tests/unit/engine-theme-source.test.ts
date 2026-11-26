import { describe, expect, it } from "vitest";
import { FONT_KEYS } from "../../lib/templates/engine/fonts";
import { buildThemeSettingsSchema, getRootSchema, themeSettingsSchema } from "../../lib/templates/engine/root-schema";
import { ALLOWED_SOCIAL_NETWORKS } from "../../lib/templates/engine/schema";
import { themeToCssVars, type ThemeSettings } from "../../lib/templates/engine/theme-css";
import { validateDocument } from "../../lib/templates/engine/validate";
import type { SettingDescriptor } from "../../lib/templates/engine/descriptors";
import { getRegistry } from "../../lib/templates/registry/index";
import { THEME_GROUPS, themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";
import { DEFAULT_WORDING, WORDING_GROUP, WORDING_KEYS, WORDING_MAX } from "../../lib/storefront/wording";

/**
 * AC-ENG-001 (theme part): the theme setting descriptors (registry/theme-settings.ts) are the ONLY definition of the
 * theme settings. The stored document is `settings[group][id]`; `themeSettingsSchema` is generated from the
 * descriptors and `themeToCssVars` takes its bounds from them. These tests replace the former "open gap" tests.
 */
const registry = getRegistry();
const T = "tenant-a";
const theme = (settings: Record<string, unknown>) => ({ schemaVersion: 1, settings });
const ok = (settings: Record<string, unknown>) => themeSettingsSchema.safeParse(theme(settings)).success;
const descriptor = (id: string) => themeSettingDescriptors.find((d) => d.id === id);
const byGroup = (group: string) => themeSettingDescriptors.filter((d) => d.group === group);

type Introspectable = { shape: Record<string, { unwrap(): { shape?: Record<string, unknown> } }> };
/** The keys of each generated group object, read off the generated schema (`null` for the social check, which has no shape). */
function generatedKeys(schema = themeSettingsSchema): Record<string, string[] | null> {
  const settings = (schema as unknown as Introspectable).shape.settings.unwrap() as unknown as Introspectable;
  const out: Record<string, string[] | null> = {};
  for (const [group, optional] of Object.entries(settings.shape)) {
    const inner = optional.unwrap();
    out[group] = inner.shape ? Object.keys(inner.shape) : null;
  }
  return out;
}

const NEUTRAL_DEFAULTS: Record<string, unknown> = {
  favicon: null,
  primary: "#1a5aaa",
  secondary: "#64748b",
  background: "#ffffff",
  text: "#0f172a",
  accent: "#f59e0b",
  muted: "#94a3b8",
  border: "#e2e8f0",
  headingFont: "manrope",
  bodyFont: "inter",
  baseSize: 16,
  headingWeight: 700,
  bodyWeight: 400,
  lineHeight: 1.5,
  pageWidth: 1280,
  gridGap: 24,
  radius: 6,
};

describe("[AC-ENG-001] theme descriptors are the single source of the theme settings", () => {
  it("[AC-ENG-001] THEME_GROUPS is the closed list of the eight D24 groups, and every descriptor's group is one of them", () => {
    expect([...THEME_GROUPS]).toEqual(["brand", "colors", "typography", "layout", "buttons", "productCards", "productPage", "social"]);
    expect(Object.isFrozen(THEME_GROUPS)).toBe(true);
    for (const d of themeSettingDescriptors) expect({ id: d.id, known: (THEME_GROUPS as readonly string[]).includes(d.group ?? "") }).toEqual({ id: d.id, known: true });
    // productPage is populated by a later phase. productCards holds the shopping wording (lib/storefront/wording.ts).
    expect(byGroup("productCards").map((d) => d.id)).toEqual([...WORDING_KEYS]);
    expect(byGroup("productPage")).toEqual([]);
  });

  it("[AC-ENG-001] the ids are the nested keys of the stored document, grouped as D24 says", () => {
    const idsOf = (group: string) => byGroup(group).map((d) => d.id);
    expect(idsOf("brand")).toEqual(["favicon", "look"]);
    expect(idsOf("colors")).toEqual(["primary", "secondary", "background", "text", "accent", "muted", "border"]);
    expect(idsOf("typography")).toEqual(["headingFont", "bodyFont", "baseSize", "headingWeight", "bodyWeight", "lineHeight"]);
    expect(idsOf("layout")).toEqual(["pageWidth", "gridGap"]);
    expect(idsOf("buttons")).toEqual(["radius"]);
    expect(idsOf("productCards")).toEqual(["addToBagLabel", "emptyCartTitle", "emptyCartMessage", "emptyWishlistTitle", "emptyWishlistMessage"]);
    expect(idsOf("social")).toEqual(Object.keys(ALLOWED_SOCIAL_NETWORKS));
    expect(new Set(themeSettingDescriptors.map((d) => d.id)).size).toBe(themeSettingDescriptors.length);
  });

  it("[AC-ENG-001] every key of the generated schema exists as a descriptor, and every descriptor is a key of the schema", () => {
    const keys = generatedKeys();
    const groupsWithDescriptors = THEME_GROUPS.filter((g) => byGroup(g).length > 0);
    // `pages` is the one group without descriptors: whole page documents for the generated storefront pages (lib/storefront/pages.ts).
    expect(Object.keys(keys).sort()).toEqual([...groupsWithDescriptors, "pages"].sort());
    for (const group of groupsWithDescriptors) {
      const schemaKeys = keys[group] ?? Object.keys(ALLOWED_SOCIAL_NETWORKS); // social: the host-checked rule, keyed by the one network list
      expect({ group, keys: [...schemaKeys].sort() }).toEqual({ group, keys: byGroup(group).map((d) => d.id).sort() });
    }
  });

  it("[AC-ENG-001] defaults come from the descriptors; the values the plan did not specify are pinned here", () => {
    for (const [id, value] of Object.entries(NEUTRAL_DEFAULTS)) expect({ id, default: descriptor(id)?.default }).toEqual({ id, default: value });
    for (const network of Object.keys(ALLOWED_SOCIAL_NETWORKS)) expect(descriptor(network)?.default).toBe("");
    // Every default is itself a valid stored value (a blank social link is "no link": absent in a stored document).
    for (const d of themeSettingDescriptors.filter((x) => x.group !== "social")) {
      expect({ id: d.id, ok: ok({ [d.group as string]: { [d.id]: d.default } }) }).toEqual({ id: d.id, ok: true });
    }
    // The default weights are valid for the default fonts (manrope 700, inter 400).
    expect(ok({ typography: { headingWeight: descriptor("headingWeight")?.default, bodyWeight: descriptor("bodyWeight")?.default } })).toBe(true);
  });

  describe("shopping wording (the productCards group, shown as Shopping wording in the editor)", () => {
    const wording = (key: string, value: unknown) => ok({ productCards: { [key]: value } });

    it("has the exact current storefront words as its defaults", () => {
      expect(WORDING_GROUP).toBe("productCards");
      expect(DEFAULT_WORDING).toEqual({
        addToBagLabel: "Add to bag",
        emptyCartTitle: "Your bag is empty",
        emptyCartMessage: "Pieces you add appear here, saved in this browser for this store.",
        emptyWishlistTitle: "Nothing saved yet",
        emptyWishlistMessage: "Tap the heart on any piece to keep it here, saved in this browser for this store.",
      });
      for (const key of WORDING_KEYS) expect({ key, default: descriptor(key)?.default }).toEqual({ key, default: DEFAULT_WORDING[key] });
    });

    it("has a label, help text, a text type and the length limit from the shared file for each setting", () => {
      for (const key of WORDING_KEYS) {
        const d = descriptor(key);
        expect({ key, group: d?.group, max: d?.max, label: Boolean(d?.label), help: Boolean(d?.help) }).toEqual({ key, group: "productCards", max: WORDING_MAX[key], label: true, help: true });
        expect({ key, type: d?.type }).toEqual({ key, type: key.endsWith("Message") ? "textarea" : "text" });
      }
      expect(WORDING_MAX).toEqual({ addToBagLabel: 30, emptyCartTitle: 60, emptyCartMessage: 160, emptyWishlistTitle: 60, emptyWishlistMessage: 160 });
    });

    it("accepts a value of exactly the limit and rejects one character more", () => {
      for (const key of WORDING_KEYS) {
        expect({ key, atLimit: wording(key, "x".repeat(WORDING_MAX[key])) }).toEqual({ key, atLimit: true });
        expect({ key, overLimit: wording(key, "x".repeat(WORDING_MAX[key] + 1)) }).toEqual({ key, overLimit: false });
      }
    });

    it("rejects values that are not text and keys that are not wording", () => {
      for (const bad of [5, true, null, {}, ["Add"]]) expect(wording("addToBagLabel", bad)).toBe(false);
      expect(ok({ productCards: { somethingElse: "x" } })).toBe(false);
    });

    it("leaves the other groups and stores that never set it unaffected", () => {
      expect(ok({})).toBe(true);
      expect(ok({ productCards: {} })).toBe(true);
      expect(ok({ buttons: { radius: 6 }, productCards: { addToBagLabel: "Buy now" } })).toBe(true);
    });
  });

  it("[AC-ENG-001] the font descriptors agree with the closed font list", () => {
    for (const id of ["headingFont", "bodyFont"]) {
      expect(descriptor(id)?.options?.map((o) => o.value).sort()).toEqual([...FONT_KEYS].sort());
    }
  });

  it("[AC-ENG-001] the stored shape is nested by group and accepts any subset of known settings", () => {
    expect(ok({})).toBe(true);
    expect(ok({ colors: { primary: "#112233" }, typography: { headingFont: "inter" }, layout: { pageWidth: 1200 }, buttons: { radius: 8 } })).toBe(true);
    expect(ok({ colors: { primary: "red" } })).toBe(false);
    expect(ok({ social: { facebook: "https://facebook.com/x" } })).toBe(true);
    expect(ok({ social: { facebook: "https://evil.example/x" } })).toBe(false);
    const all = { primary: "#111111", secondary: "#222222", background: "#333333", text: "#444444", accent: "#555555", muted: "#666666", border: "#777777" };
    expect(ok({ colors: all })).toBe(true);
    for (const key of Object.keys(all)) expect(ok({ colors: { [key]: "nope" } })).toBe(false);
  });
});

describe("[AC-ENG-001] unknown groups and keys are rejected (no catch-all)", () => {
  it("[AC-ENG-001] an unknown group, an unknown key inside a group, and the old flat ids are rejected", () => {
    expect(ok({ branding: { logo: "x" } })).toBe(false);
    expect(ok({ productPage: {} })).toBe(false); // a group without descriptors yet is not accepted either (productCards now has the shopping wording)
    expect(ok({ productCards: { sparkle: "x" } })).toBe(false); // an unknown key inside the wording group is rejected like any other
    expect(ok({ colors: { primary: "#112233", favicon: "red" } })).toBe(false);
    expect(ok({ typography: { fontFamily: "evil; }" } })).toBe(false);
    expect(ok({ layout: { css: "x" } })).toBe(false);
    expect(ok({ buttons: { shadow: "0 0 9px red" } })).toBe(false);
    expect(ok({ brand: { logo: null } })).toBe(false);
    expect(ok({ primaryColor: "not a colour" })).toBe(false);
    expect(ok({ pageWidth: "wide", buttonRadius: -5, headingFont: 42 })).toBe(false);
    expect(ok({ favicon: { note: "free form" } })).toBe(false);
  });

  it("[AC-ENG-001] validateDocument reports each unknown key at its own path as a SCHEMA_ERROR", () => {
    const res = validateDocument("theme_settings", theme({ extra: 1, colors: { primary: "#112233", glow: "#ffffff" } }), registry, { tenantId: T });
    expect(res.ok).toBe(false);
    const paths = res.issues.filter((i) => i.code === "SCHEMA_ERROR").map((i) => i.path);
    expect(paths.sort()).toEqual(["settings.colors.glow", "settings.extra"]);
  });

  it("[AC-ENG-006] an own __proto__ key is still rejected at settings and inside a group", () => {
    const rootProto = JSON.parse('{"schemaVersion":1,"settings":{"__proto__":{"x":1}}}');
    const groupProto = JSON.parse('{"schemaVersion":1,"settings":{"colors":{"__proto__":"#112233"}}}');
    for (const [doc, path] of [
      [rootProto, "settings.__proto__"],
      [groupProto, "settings.colors.__proto__"],
    ] as const) {
      const res = validateDocument("theme_settings", doc, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.some((i) => i.path === path && i.code === "SCHEMA_ERROR")).toBe(true);
    }
  });
});

describe("[AC-ENG-001] numeric bounds: descriptor, generated schema and CSS cleaner agree", () => {
  const numeric = themeSettingDescriptors.filter((d) => d.min !== undefined && d.max !== undefined);
  const group = (d: SettingDescriptor) => d.group as string;
  /** A typography document that keeps the weights valid for the chosen font: inter provides 100 to 900. */
  const doc = (d: SettingDescriptor, value: number): Record<string, unknown> => ({
    [group(d)]: { ...(group(d) === "typography" ? { headingFont: "inter", bodyFont: "inter" } : {}), [d.id]: value },
  });

  it("[AC-ENG-001] there are numeric theme descriptors, with the bounds validated before this change", () => {
    expect(numeric.map((d) => [d.id, d.min, d.max])).toEqual([
      ["baseSize", 10, 40],
      ["headingWeight", 100, 900],
      ["bodyWeight", 100, 900],
      ["lineHeight", 0.8, 2.5],
      ["pageWidth", 800, 1920],
      ["gridGap", 0, 100],
      ["radius", 0, 50],
    ]);
  });

  it("[AC-ENG-001] for every numeric theme descriptor the CSS cleaner and the schema accept min and max and reject just outside", () => {
    for (const d of numeric) {
      const min = d.min as number;
      const max = d.max as number;
      const below = Math.round((min - 0.1) * 10) / 10;
      const above = Math.round((max + 0.1) * 10) / 10;
      const css = (value: number) => themeToCssVars({ [group(d)]: { [d.id]: value } } as ThemeSettings);
      for (const value of [min, max]) {
        expect({ id: d.id, value, schema: ok(doc(d, value)), css: css(value) !== "" }).toEqual({ id: d.id, value, schema: true, css: true });
      }
      for (const value of [below, above]) {
        expect({ id: d.id, value, schema: ok(doc(d, value)), cssEmpty: css(value) === "" }).toEqual({ id: d.id, value, schema: false, cssEmpty: true });
      }
    }
  });

  it("[AC-ENG-001] a cloned descriptor list with a changed bound changes both the generated schema and the CSS cleaner (the shared registry is untouched)", () => {
    const cloned = structuredClone(themeSettingDescriptors);
    const width = cloned.find((d) => d.id === "pageWidth") as SettingDescriptor;
    width.min = 900;
    width.max = 1000;
    const custom = buildThemeSettingsSchema(cloned);
    const parse = (value: number) => custom.safeParse(theme({ layout: { pageWidth: value } })).success;
    expect([parse(899), parse(900), parse(1000), parse(1001)]).toEqual([false, true, true, false]);
    expect([1200, 1000, 900, 899].map((v) => themeToCssVars({ layout: { pageWidth: v } }, cloned))).toEqual([
      "",
      "--sf-page-width: 1000px;",
      "--sf-page-width: 900px;",
      "",
    ]);
    // The registry and the default schema still use 800 to 1920.
    expect(themeToCssVars({ layout: { pageWidth: 1200 } })).toBe("--sf-page-width: 1200px;");
    expect(ok({ layout: { pageWidth: 1200 } })).toBe(true);
    expect([descriptor("pageWidth")?.min, descriptor("pageWidth")?.max]).toEqual([800, 1920]);
  });

  it("[AC-ENG-001] a numeric value with no descriptor bound is not rendered, and a descriptor without a group is refused by the builder", () => {
    const withoutLayout = themeSettingDescriptors.filter((d) => d.group !== "layout");
    expect(themeToCssVars({ layout: { pageWidth: 1200 } }, withoutLayout)).toBe("");
    expect(() => buildThemeSettingsSchema([{ id: "loose", type: "text", label: "Loose", default: "" }])).toThrow(/known group/);
    expect(() => buildThemeSettingsSchema([{ id: "x1", type: "text", label: "X", default: "", group: "nope" }])).toThrow(/known group/);
  });

  it("[AC-ENG-001] the cleaned output keeps the existing var names and format", () => {
    expect(themeToCssVars({ layout: { pageWidth: 800 } })).toBe("--sf-page-width: 800px;");
    expect(themeToCssVars({ layout: { pageWidth: 1920 } })).toBe("--sf-page-width: 1920px;");
    expect(themeToCssVars({ layout: { pageWidth: 1921 } })).toBe("");
    expect(themeToCssVars({ buttons: { radius: 50 } })).toBe("--sf-button-radius: 50px;");
    expect(themeToCssVars({ buttons: { radius: 51 } })).toBe("");
  });
});

describe("[AC-ENG-001] weights are checked against the effective font", () => {
  it("[AC-ENG-013] [AC-ENG-001] a weight must be one the chosen font provides, else the descriptor default font", () => {
    expect(ok({ typography: { headingFont: "inter", headingWeight: 900 } })).toBe(true);
    expect(ok({ typography: { headingFont: "manrope", headingWeight: 900 } })).toBe(false);
    expect(ok({ typography: { headingWeight: 900 } })).toBe(false); // default heading font manrope: 200 to 800
    expect(ok({ typography: { headingWeight: 800 } })).toBe(true);
    expect(ok({ typography: { bodyWeight: 900 } })).toBe(true); // default body font inter: 100 to 900
    expect(ok({ typography: { bodyFont: "system-serif", bodyWeight: 500 } })).toBe(false);
    expect(ok({ typography: { bodyFont: "system-serif", bodyWeight: 700 } })).toBe(true);
  });

  it("[AC-ENG-001] the default font comes from the descriptors: a clone with another default font changes the rule", () => {
    const cloned = structuredClone(themeSettingDescriptors);
    (cloned.find((d) => d.id === "headingFont") as SettingDescriptor).default = "inter";
    const custom = buildThemeSettingsSchema(cloned);
    expect(custom.safeParse(theme({ typography: { headingWeight: 900 } })).success).toBe(true);
    expect(ok({ typography: { headingWeight: 900 } })).toBe(false);
  });
});

describe("[AC-ENG-001] [AC-ENG-016] the favicon image reaches the tenant-aware compile", () => {
  const favicon = (path: string) => ({ brand: { favicon: { path, alt: "icon" } } });

  it("[AC-ENG-016] favicon: own tenant accepted, foreign tenant rejected, no tenant rejected, null accepted", () => {
    const own = validateDocument("theme_settings", theme(favicon(`${T}/store/favicon.png`)), registry, { tenantId: T });
    expect(own.ok).toBe(true);

    const foreign = validateDocument("theme_settings", theme(favicon("tenant-b/store/favicon.png")), registry, { tenantId: T });
    expect(foreign.ok).toBe(false);
    expect(foreign.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual(["settings.brand.favicon"]);

    const noTenant = validateDocument("theme_settings", theme(favicon(`${T}/store/favicon.png`)), registry);
    expect(noTenant.ok).toBe(false);
    expect(noTenant.issues.filter((i) => i.code === "TENANT_REQUIRED").map((i) => i.path)).toEqual(["settings.brand.favicon"]);

    expect(validateDocument("theme_settings", theme({ brand: { favicon: null } }), registry).ok).toBe(true);
    // The schema itself (not only validateDocument) is tenant-aware.
    expect(getRootSchema("theme_settings", T).safeParse(theme(favicon(`${T}/store/f.png`))).success).toBe(true);
    expect(getRootSchema("theme_settings", T).safeParse(theme(favicon("tenant-b/store/f.png"))).success).toBe(false);
    expect(getRootSchema("theme_settings").safeParse(theme(favicon(`${T}/store/f.png`))).success).toBe(false);
  });

  it("[AC-ENG-016] the compiled theme schema is cached per tenant and never shared between tenants", () => {
    const a = getRootSchema("theme_settings", T);
    expect(getRootSchema("theme_settings", T)).toBe(a);
    expect(getRootSchema("theme_settings", "tenant-b")).not.toBe(a);
    expect(getRootSchema("theme_settings")).toBe(themeSettingsSchema);
    // Many tenants stay bounded and the most recent one stays cached.
    for (let i = 0; i < 50; i++) getRootSchema("theme_settings", `t${i}`);
    expect(getRootSchema("theme_settings", "t49")).toBe(getRootSchema("theme_settings", "t49"));
  });

  it("[AC-ENG-016] images anywhere under settings, in arrays, with traversal tricks, or at the root are rejected too (structural scan, defence in depth)", () => {
    const cases: Record<string, Record<string, unknown>> = {
      nested: { brand: { logos: { dark: { path: "tenant-b/store/x.png" } } } },
      "in an array": { gallery: [{ path: `${T}/store/ok.png` }, { path: "tenant-b/store/x.png" }] },
      traversal: { brand: { favicon: { path: `${T}/store/../tenant-b/store/x.png` } } },
      "other scheme": { brand: { favicon: { path: "https://evil.example/x.png" } } },
      "not text": { brand: { favicon: { path: 42 } } },
      "unknown key": { favicon: { path: "tenant-b/store/x.png" } },
    };
    for (const [label, settings] of Object.entries(cases)) {
      const res = validateDocument("theme_settings", theme(settings), registry, { tenantId: T });
      expect({ label, ok: res.ok }).toEqual({ label, ok: false });
    }
    // The scan still names the offending image under a key the schema rejects as unknown.
    const unknownKey = validateDocument("theme_settings", theme({ favicon: { path: "tenant-b/store/x.png" } }), registry, { tenantId: T });
    expect(unknownKey.issues.some((i) => i.code === "CROSS_TENANT_PATH" && i.path === "settings.favicon")).toBe(true);

    const root = validateDocument("theme_settings", { schemaVersion: 1, favicon: { path: "tenant-b/store/x.png" } }, registry, { tenantId: T });
    expect(root.ok).toBe(false);
    expect(root.issues.some((i) => i.code === "CROSS_TENANT_PATH" && i.path === "favicon")).toBe(true);
  });

  it("[AC-ENG-001] theme-css ignores every unknown key: nothing hostile reaches CSS", () => {
    const hostile = {
      colors: { primary: "#112233", favicon: "red; } body { display: none", url: "url(javascript:alert(1))" },
      typography: { headingFont: "inter", fontFamily: "evil; }", customCss: "a{}" },
      layout: { pageWidth: 1200, css: "x" },
      buttons: { radius: 8, shadow: "0 0 9px red" },
      favicon: { path: "tenant-a/store/f.png" },
      primaryColor: "red; } *{display:none",
      pageWidth: "100px; } *{",
      customCss: "body { display: none }",
      __unknown__: "x",
    } as unknown as ThemeSettings;
    const css = themeToCssVars(hostile);
    expect(css).toBe(
      ["--sf-color-primary: #112233;", "--sf-font-heading: var(--font-inter), sans-serif;", "--sf-page-width: 1200px;", "--sf-button-radius: 8px;"].join("\n"),
    );
    expect(css).not.toMatch(/display|javascript|evil|favicon|customCss|\}/);
  });
});
