import { describe, expect, it } from "vitest";
import { compileSettingSchema, compileSettings } from "../../lib/templates/engine/compile";
import {
  assertValidDescriptors,
  checkDescriptors,
} from "../../lib/templates/engine/descriptor-check";
import {
  isSettingType,
  SETTING_TYPES,
  type ComponentRegistry,
  type SettingDescriptor,
  type SettingType,
} from "../../lib/templates/engine/descriptors";
import { validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";
import { THEME_GROUPS, themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";
import type { TemplateDocument } from "../../lib/templates/document";

const TENANT = "t1";

const OPTIONS = [
  { label: "A", value: "a" },
  { label: "B", value: "b" },
];

/** One valid sample value for every setting type (the closed D5 list). */
const SAMPLES: Record<SettingType, unknown> = {
  text: "hello",
  textarea: "hello\nworld",
  richtext: "**hello** world",
  number: 5,
  range: 5,
  toggle: true,
  select: "a",
  radio: "a",
  segmented: "a",
  color: "#aabbcc",
  image: { path: `${TENANT}/store/a.png`, alt: "A" },
  url: "/products",
  spacing: { top: 1, unit: "px" },
  typography: { fontFamily: "inter", fontSize: 16 },
  border: { width: 1, style: "solid", color: "#111111" },
  dataBinding: { source: "store.name", fallback: "Shop" },
};

function descriptorFor(type: SettingType, extra: Partial<SettingDescriptor> = {}): SettingDescriptor {
  const withOptions = type === "select" || type === "radio" || type === "segmented";
  return {
    id: "value",
    type,
    label: "Value",
    default: SAMPLES[type],
    ...(withOptions ? { options: OPTIONS } : {}),
    ...extra,
  };
}

const parseWith = (d: SettingDescriptor) => {
  const { schema } = compileSettings([d], { tenantId: TENANT });
  return (value: unknown) => schema.safeParse({ value }).success;
};

describe("One descriptor list drives controls, validation and defaults [AC-ENG-001]", () => {
  const list: SettingDescriptor[] = [
    {
      id: "heading",
      type: "text",
      label: "Heading",
      default: "Hi",
      help: "Shown first",
      group: "content",
      min: 1,
      max: 10,
    },
    {
      id: "cta",
      type: "url",
      label: "Link",
      default: "/shop",
      group: "content",
      visibleIf: { setting: "showCta", eq: true },
    },
    { id: "showCta", type: "toggle", label: "Show link", default: true, group: "content" },
    { id: "variant", type: "select", label: "Variant", default: "a", options: OPTIONS, group: "style" },
  ];

  it("[AC-ENG-001] the editor control metadata, the Zod schema and the defaults are all derived from the same objects", () => {
    const compiled = compileSettings(list, { tenantId: TENANT });

    // (a) control metadata IS the descriptor (same reference, no second hand-written copy)
    expect(Object.keys(compiled.metadata)).toEqual(list.map((d) => d.id));
    for (const d of list) expect(compiled.metadata[d.id]).toBe(d);
    expect(compiled.metadata.heading).toMatchObject({
      type: "text",
      label: "Heading",
      group: "content",
      help: "Shown first",
      min: 1,
      max: 10,
    });
    expect(compiled.metadata.cta.visibleIf).toEqual({ setting: "showCta", eq: true });
    expect(compiled.metadata.variant.options).toEqual(OPTIONS);

    // (b) the schema has exactly the descriptor ids
    expect(Object.keys(compiled.schema.shape)).toEqual(list.map((d) => d.id));

    // (c) the defaults are the descriptor defaults
    expect(compiled.defaults).toEqual({ heading: "Hi", cta: "/shop", showCta: true, variant: "a" });
    expect(compiled.schema.safeParse(compiled.defaults).success).toBe(true);
  });

  it("[AC-ENG-001] changing one descriptor changes metadata, validation and defaults together, with no other edit", () => {
    const edited = list.map((d) => (d.id === "heading" ? { ...d, max: 3, default: "Yo", label: "Title" } : d));
    const before = compileSettings(list);
    const after = compileSettings(edited);

    expect(after.metadata.heading.label).toBe("Title");
    expect(after.defaults.heading).toBe("Yo");
    expect(before.schema.safeParse({ heading: "Hello" }).success).toBe(true);
    expect(after.schema.safeParse({ heading: "Hello" }).success).toBe(false);
    expect(after.schema.safeParse({ heading: "Yo" }).success).toBe(true);
  });

  it("[AC-ENG-001] a descriptor change reaches validateDocument through the registry (no separate validation rules)", () => {
    const def = (max: number): ComponentRegistry => ({
      sections: {
        banner: {
          type: "banner",
          name: "Banner",
          settings: [{ id: "title", type: "text", label: "Title", default: "", max }],
        },
      },
      blocks: {},
    });
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: { s1: { type: "banner", settings: { title: "abcdef" }, blocks: {}, block_order: [] } },
      order: ["s1"],
    };
    expect(validateDocument("index", doc, def(10)).ok).toBe(true);
    expect(validateDocument("index", doc, def(3)).ok).toBe(false);
  });

  describe("every shipped definition is a valid descriptor list", () => {
    const registry = getRegistry();
    const definitions = [
      ...Object.entries(registry.sections).map(([key, def]) => ({ label: `section ${key}`, key, def })),
      ...Object.entries(registry.blocks).map(([key, def]) => ({ label: `block ${key}`, key, def })),
    ];

    it("[AC-ENG-001] the registry holds hero and product-grid sections", () => {
      expect(Object.keys(registry.sections)).toEqual(expect.arrayContaining(["hero", "product-grid"]));
    });

    for (const { label, key, def } of definitions) {
      it(`[AC-ENG-001] ${label} is keyed by its own type, passes descriptor validation and its defaults pass its own schema`, () => {
        expect(def.type).toBe(key);
        expect(def.name.length).toBeGreaterThan(0);
        expect(checkDescriptors(def.settings)).toEqual([]);
        const { schema, defaults } = compileSettings(def.settings, { tenantId: TENANT });
        expect(schema.safeParse(defaults).success).toBe(true);
        expect(Object.keys(defaults)).toEqual(def.settings.map((s) => s.id));
      });
    }

    it("[AC-ENG-001] the theme settings descriptors pass descriptor validation and their defaults pass their own schema", () => {
      expect(checkDescriptors(themeSettingDescriptors)).toEqual([]);
      const { schema, defaults } = compileSettings(themeSettingDescriptors);
      expect(schema.safeParse(defaults).success).toBe(true);
      for (const d of themeSettingDescriptors) {
        expect(typeof d.group).toBe("string");
        expect({ id: d.id, inThemeGroups: (THEME_GROUPS as readonly string[]).includes(d.group as string) }).toEqual({ id: d.id, inThemeGroups: true });
        expect(d.label.length).toBeGreaterThan(0);
      }
    });
  });

  it("[AC-ENG-001] a descriptor list with a bad id or duplicate ids is rejected at definition time and by the compiler", () => {
    const dup: SettingDescriptor[] = [
      { id: "a", type: "text", label: "A", default: "" },
      { id: "a", type: "text", label: "A again", default: "" },
    ];
    expect(checkDescriptors(dup).join("\n")).toMatch(/duplicate/i);
    expect(() => assertValidDescriptors(dup, "dup")).toThrow(/dup.*duplicate/i);
    expect(() => compileSettings(dup)).toThrow(/duplicate/i);

    for (const id of ["__proto__", "constructor", "toString", "", "has space", "1abc"]) {
      const bad: SettingDescriptor[] = [{ id, type: "text", label: "X", default: "" }];
      expect(checkDescriptors(bad).length).toBeGreaterThan(0);
      expect(() => compileSettings(bad)).toThrow();
    }
  });

  it("[AC-ENG-001] compiling the same list repeatedly yields equivalent schemas and fresh defaults (no state leaks between calls)", () => {
    const shared: SettingDescriptor[] = [
      { id: "pad", type: "spacing", label: "Padding", default: { top: 10, bottom: 10 } },
      { id: "title", type: "text", label: "Title", default: "Hi", max: 5 },
    ];
    const first = compileSettings(shared);
    const second = compileSettings(shared);

    for (const value of [{ title: "Hello" }, { title: "Hello!" }, { pad: { top: 1 } }, { pad: { top: "x" } }, {}]) {
      expect(second.schema.safeParse(value).success).toBe(first.schema.safeParse(value).success);
    }

    // Mutating a returned default must not change the descriptor or the next compile.
    (first.defaults.pad as { top: number }).top = 99;
    first.defaults.title = "changed";
    expect(shared[0].default).toEqual({ top: 10, bottom: 10 });
    expect(compileSettings(shared).defaults).toEqual({ pad: { top: 10, bottom: 10 }, title: "Hi" });
    expect(second.defaults.pad).toEqual({ top: 10, bottom: 10 });
    expect(second.defaults.pad).not.toBe(first.defaults.pad);
  });
});

describe("The setting type enum is closed [AC-ENG-002]", () => {
  it("[AC-ENG-002] SETTING_TYPES is exactly the D5 list, in order, and is not extensible at runtime", () => {
    expect([...SETTING_TYPES]).toEqual([
      "text",
      "textarea",
      "richtext",
      "number",
      "range",
      "toggle",
      "select",
      "radio",
      "segmented",
      "color",
      "image",
      "url",
      "spacing",
      "typography",
      "border",
      "dataBinding",
    ]);
    expect(SETTING_TYPES).toHaveLength(16);
  });

  it("[AC-ENG-002] SETTING_TYPES is frozen: a runtime push, assignment or pop cannot extend or change the closed enum", () => {
    expect(Object.isFrozen(SETTING_TYPES)).toBe(true);
    const mutable = SETTING_TYPES as unknown as string[];
    expect(() => mutable.push("video")).toThrow();
    expect(() => {
      mutable[0] = "video";
    }).toThrow();
    expect(() => mutable.pop()).toThrow();
    expect(SETTING_TYPES).toHaveLength(16);
    expect(isSettingType("video")).toBe(false);
  });

  const forbidden = ["video", "file", "icon", "custom_code", "html", "", "TEXT", "__proto__", "constructor", "toString", "hasOwnProperty"];

  it("[AC-ENG-002] isSettingType rejects video, file, icon, unknown strings and prototype names", () => {
    for (const name of forbidden) expect({ name, ok: isSettingType(name) }).toEqual({ name, ok: false });
  });

  it("[AC-ENG-002] definition-time validation rejects a forbidden or unknown type", () => {
    for (const name of forbidden) {
      const d = { id: "x", type: name, label: "X", default: null } as unknown as SettingDescriptor;
      const problems = checkDescriptors([d]);
      expect({ name, rejected: problems.length > 0 }).toEqual({ name, rejected: true });
      expect(() => assertValidDescriptors([d], "def")).toThrow(/type/i);
    }
  });

  it("[AC-ENG-002] the compiler rejects a forbidden or unknown type instead of accepting any value", () => {
    for (const name of forbidden) {
      const d = { id: "x", type: name, label: "X", default: null } as unknown as SettingDescriptor;
      expect(() => compileSettings([d])).toThrow(/type/i);
      expect(() => compileSettingSchema(d)).toThrow(/type/i);
    }
  });

  it("[AC-ENG-002] every allowed type compiles", () => {
    for (const type of SETTING_TYPES) {
      expect(() => compileSettings([descriptorFor(type)], { tenantId: TENANT })).not.toThrow();
      expect(parseWith(descriptorFor(type))(SAMPLES[type])).toBe(true);
    }
  });
});

describe("Responsive values exist only when responsive is true [AC-ENG-003]", () => {
  for (const type of SETTING_TYPES) {
    it(`[AC-ENG-003] ${type}: a non-responsive setting accepts a plain value and rejects the responsive shape`, () => {
      const ok = parseWith(descriptorFor(type));
      const sample = SAMPLES[type];
      expect(ok(sample)).toBe(true);
      expect(ok({ base: sample })).toBe(false);
      expect(ok({ base: sample, tablet: sample, mobile: sample })).toBe(false);
    });

    it(`[AC-ENG-003] ${type}: a responsive setting accepts base only, base+tablet, all breakpoints and a plain value`, () => {
      const ok = parseWith(descriptorFor(type, { responsive: true }));
      const s = SAMPLES[type];
      expect(ok(s)).toBe(true);
      expect(ok({ base: s })).toBe(true);
      expect(ok({ base: s, tablet: s })).toBe(true);
      expect(ok({ base: s, mobile: s })).toBe(true);
      expect(ok({ base: s, tablet: s, mobile: s })).toBe(true);
    });

    it(`[AC-ENG-003] ${type}: a responsive setting rejects unknown breakpoints, a missing base and non-objects`, () => {
      const ok = parseWith(descriptorFor(type, { responsive: true }));
      const s = SAMPLES[type];
      expect(ok({ base: s, desktop: s })).toBe(false);
      expect(ok({ base: s, wide: s })).toBe(false);
      expect(ok(JSON.parse(`{"base": ${JSON.stringify(s)}, "__proto__": ${JSON.stringify(s)}}`))).toBe(false);
      expect(ok({ tablet: s })).toBe(false);
      expect(ok({ tablet: s, mobile: s })).toBe(false);
      expect(ok([s])).toBe(false);
    });

    it(`[AC-ENG-003] ${type}: each breakpoint value is validated like the base value`, () => {
      const ok = parseWith(descriptorFor(type, { responsive: true }));
      const s = SAMPLES[type];
      const bad = [s];
      expect(ok({ base: s, tablet: bad })).toBe(false);
      expect(ok({ base: s, mobile: bad })).toBe(false);
      expect(ok({ base: bad })).toBe(false);
    });
  }

  it("[AC-ENG-003] the default of a responsive setting may be the responsive shape and validates against its own schema", () => {
    const d: SettingDescriptor = {
      id: "size",
      type: "number",
      label: "Size",
      default: { base: 16, tablet: 14 },
      responsive: true,
      min: 8,
      max: 40,
    };
    const { schema, defaults } = compileSettings([d]);
    expect(defaults.size).toEqual({ base: 16, tablet: 14 });
    expect(schema.safeParse(defaults).success).toBe(true);
    // The same shape is invalid when the descriptor is not responsive.
    expect(compileSettings([{ ...d, responsive: false }]).schema.safeParse(defaults).success).toBe(false);
  });
});
