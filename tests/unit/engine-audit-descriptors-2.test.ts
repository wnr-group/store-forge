import { describe, expect, it } from "vitest";
import { compileSettings } from "../../lib/templates/engine/compile";
import { assertValidDescriptors, checkDescriptors, isSettingVisible } from "../../lib/templates/engine/descriptor-check";
import type { ComponentRegistry, SettingDescriptor } from "../../lib/templates/engine/descriptors";
import { validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";
import { themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";
import type { TemplateDocument } from "../../lib/templates/document";

// Second half of the descriptor audit (split from engine-audit-descriptors.test.ts to stay under 500 lines).
const TENANT = "t1";

const OPTIONS = [
  { label: "A", value: "a" },
  { label: "B", value: "b" },
];

describe("Groups, help, visibility and messages come from descriptors [AC-ENG-004]", () => {
  const list: SettingDescriptor[] = [
    { id: "mode", type: "select", label: "Mode", default: "a", options: OPTIONS },
    { id: "extra", type: "text", label: "Extra", default: "", visibleIf: { setting: "mode", eq: "b" } },
    { id: "other", type: "text", label: "Other", default: "", visibleIf: { setting: "mode", neq: "a" } },
    { id: "either", type: "text", label: "Either", default: "", visibleIf: { setting: "mode", in: ["a", "c"] } },
  ];
  const byId = (id: string) => list.find((d) => d.id === id)!;

  it("[AC-ENG-004] visibleIf eq, neq and in are evaluated against the effective values", () => {
    expect(isSettingVisible(byId("extra"), { mode: "b" })).toBe(true);
    expect(isSettingVisible(byId("extra"), { mode: "a" })).toBe(false);
    expect(isSettingVisible(byId("other"), { mode: "b" })).toBe(true);
    expect(isSettingVisible(byId("other"), { mode: "a" })).toBe(false);
    expect(isSettingVisible(byId("either"), { mode: "c" })).toBe(true);
    expect(isSettingVisible(byId("either"), { mode: "b" })).toBe(false);
    // No condition: always visible.
    expect(isSettingVisible(byId("mode"), {})).toBe(true);
  });

  it("[AC-ENG-004] a missing referenced value compares as undefined and never throws or matches by accident", () => {
    expect(isSettingVisible(byId("extra"), {})).toBe(false);
    expect(isSettingVisible(byId("other"), {})).toBe(true);
    expect(isSettingVisible(byId("either"), {})).toBe(false);
    // Prototype names are not values.
    const proto: SettingDescriptor = { id: "p", type: "text", label: "P", default: "", visibleIf: { setting: "constructor", eq: undefined } };
    expect(isSettingVisible(proto, {})).toBe(true);
    expect(isSettingVisible({ ...proto, visibleIf: { setting: "toString", neq: undefined } }, {})).toBe(false);
  });

  it("[AC-ENG-004] isSettingVisible with no values object answers as it does for an empty one, and never throws", () => {
    for (const d of list) {
      const expected = isSettingVisible(d, {});
      expect({ id: d.id, visible: isSettingVisible(d, null) }).toEqual({ id: d.id, visible: expected });
      expect({ id: d.id, visible: isSettingVisible(d, undefined) }).toEqual({ id: d.id, visible: expected });
    }
  });

  it("[AC-ENG-004] visibility is not transitive and does not switch validation off: a hidden setting is still validated", () => {
    const chain: SettingDescriptor[] = [
      { id: "a", type: "toggle", label: "A", default: false },
      { id: "b", type: "toggle", label: "B", default: true, visibleIf: { setting: "a", eq: true } },
      { id: "c", type: "text", label: "C", default: "", max: 3, visibleIf: { setting: "b", eq: true } },
    ];
    // b is hidden (a is off), yet c only looks at b's value: c is visible. Hiding is not inherited down the chain.
    expect(isSettingVisible(chain[1], { a: false, b: true })).toBe(false);
    expect(isSettingVisible(chain[2], { a: false, b: true })).toBe(true);
    // A hidden setting's value is still checked against its own descriptor.
    const { schema } = compileSettings(chain);
    expect(isSettingVisible(chain[2], { b: false })).toBe(false);
    expect(schema.safeParse({ b: false, c: "toolong" }).success).toBe(false);
    expect(schema.safeParse({ b: false, c: "ok" }).success).toBe(true);
  });

  it("[AC-ENG-004] a valid visibility graph passes definition-time validation", () => {
    expect(checkDescriptors(list)).toEqual([]);
  });

  it("[AC-ENG-004] a self reference, a missing target, a cycle and an operator-less condition are rejected at definition time", () => {
    const text = (id: string, visibleIf?: SettingDescriptor["visibleIf"]): SettingDescriptor => ({
      id,
      type: "text",
      label: id,
      default: "",
      visibleIf,
    });
    const rejected: Record<string, SettingDescriptor[]> = {
      self: [text("a", { setting: "a", eq: "x" })],
      missing: [text("a", { setting: "nope", eq: "x" })],
      cycle2: [text("a", { setting: "b", eq: "x" }), text("b", { setting: "a", eq: "x" })],
      cycle3: [
        text("a", { setting: "b", eq: "x" }),
        text("b", { setting: "c", eq: "x" }),
        text("c", { setting: "a", eq: "x" }),
      ],
      noOperator: [text("a", { setting: "b" }), text("b")],
      inNotArray: [text("a", { setting: "b", in: "x" as unknown as unknown[] }), text("b")],
    };
    for (const [name, descriptors] of Object.entries(rejected)) {
      expect({ name, problems: checkDescriptors(descriptors).length > 0 }).toEqual({ name, problems: true });
      expect(() => assertValidDescriptors(descriptors, "case")).toThrow();
    }
  });

  it("[AC-ENG-004] a chain that is not a cycle is accepted", () => {
    const chain: SettingDescriptor[] = [
      { id: "a", type: "toggle", label: "A", default: true },
      { id: "b", type: "toggle", label: "B", default: true, visibleIf: { setting: "a", eq: true } },
      { id: "c", type: "text", label: "C", default: "", visibleIf: { setting: "b", eq: true } },
    ];
    expect(checkDescriptors(chain)).toEqual([]);
  });

  describe("validation messages are the descriptor-provided ones", () => {
    const custom: SettingDescriptor[] = [
      {
        id: "title",
        type: "text",
        label: "Title",
        default: "Hi",
        min: 2,
        max: 5,
        messages: { min: "Give the title at least 2 letters", max: "Keep the title to 5 letters", invalid: "The title must be text" },
      },
      {
        id: "cols",
        type: "number",
        label: "Columns",
        default: 3,
        min: 1,
        max: 6,
        messages: { min: "At least one column", max: "No more than six columns", invalid: "Columns must be a number" },
      },
      { id: "plain", type: "text", label: "Plain", default: "", max: 3 },
      { id: "accent", type: "color", label: "Accent", default: "#112233", messages: { invalid: "Pick a six-digit colour such as #112233" } },
    ];
    const messagesFor = (value: Record<string, unknown>) => {
      const res = compileSettings(custom).schema.safeParse(value);
      return res.success ? [] : res.error.issues.map((i) => i.message);
    };

    it("[AC-ENG-004] each constraint reports its own message from the descriptor", () => {
      expect(messagesFor({ title: "a" })).toEqual(["Give the title at least 2 letters"]);
      expect(messagesFor({ title: "abcdefg" })).toEqual(["Keep the title to 5 letters"]);
      expect(messagesFor({ title: 42 })).toEqual(["The title must be text"]);
      expect(messagesFor({ cols: 0 })).toEqual(["At least one column"]);
      expect(messagesFor({ cols: 7 })).toEqual(["No more than six columns"]);
      expect(messagesFor({ cols: "many" })).toEqual(["Columns must be a number"]);
      expect(messagesFor({ accent: "red" })).toEqual(["Pick a six-digit colour such as #112233"]);
    });

    it("[AC-ENG-004] a constraint with no descriptor message keeps the default message, and valid values pass", () => {
      expect(messagesFor({ plain: "abcd" })).toHaveLength(1);
      expect(messagesFor({ plain: "abcd" })[0]).not.toMatch(/title|column/i);
      expect(messagesFor({ title: "ab", cols: 3, plain: "abc", accent: "#aabbcc" })).toEqual([]);
    });

    it("[AC-ENG-004] the message reaches the validator's issue list", () => {
      const registry: ComponentRegistry = {
        sections: { banner: { type: "banner", name: "Banner", settings: custom } },
        blocks: {},
      };
      const doc: TemplateDocument = {
        schemaVersion: 1,
        layout: "classic",
        sections: { s1: { type: "banner", settings: { title: "a", cols: 9 }, blocks: {}, block_order: [] } },
        order: ["s1"],
      };
      const res = validateDocument("index", doc, registry);
      expect(res.ok).toBe(false);
      const byPath = Object.fromEntries(res.issues.map((i) => [i.path, i.message]));
      expect(byPath["sections.s1.settings.title"]).toBe("Give the title at least 2 letters");
      expect(byPath["sections.s1.settings.cols"]).toBe("No more than six columns");
    });
  });

  it("[AC-ENG-004] groups and help text of every shipped setting are plain descriptor fields, carried through metadata", () => {
    const { metadata } = compileSettings(themeSettingDescriptors);
    for (const d of themeSettingDescriptors) {
      expect(metadata[d.id].group).toBe(d.group);
      expect(metadata[d.id].help).toBe(d.help);
    }
    const hero = getRegistry().sections.hero;
    const heroMeta = compileSettings(hero.settings, { tenantId: TENANT }).metadata;
    expect(heroMeta.heading.help).toBe("Main heading displayed in the hero banner");
  });
});
