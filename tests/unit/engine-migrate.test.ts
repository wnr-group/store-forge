import { describe, expect, it } from "vitest";
import { applyMigrationSteps, MIGRATION_STEPS, migrateDocument } from "../../lib/templates/engine/migrate";
import { DOCUMENT_SCHEMA_VERSION } from "../../lib/templates/document";

/** Freezes the whole value so any write to the input throws in strict mode (ES modules are strict). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe("Engine Migrate on Read [AC-ENG-015]", () => {
  it("passes version 1 documents through as identity while normalizing fields", () => {
    const rawDoc = {
      schemaVersion: 1,
      layout: "spotlight",
      sections: {
        hero: { type: "hero", settings: { heading: "Hi" }, blocks: {}, block_order: [] },
      },
      order: ["hero"],
    };

    const migrated = migrateDocument("index", rawDoc);
    expect(migrated.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(migrated.layout).toBe("spotlight");
    expect(migrated.order).toEqual(["hero"]);
    expect(migrated.sections.hero.settings).toEqual({ heading: "Hi" });
  });

  it("normalizes missing layout for legacy/draft documents without breaking", () => {
    const rawWithoutLayout = {
      schemaVersion: 1,
      sections: {},
      order: [],
    };

    const migrated = migrateDocument("index", rawWithoutLayout);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.layout).toBe("classic");
  });

  const PAGE_KINDS = ["index", "product", "collection"] as const;
  const OTHER_KINDS = ["theme_settings", "group_header", "group_footer", "group_announcement"] as const;
  const ALL_KINDS = [...PAGE_KINDS, ...OTHER_KINDS] as const;

  for (const kind of ALL_KINDS) {
    if ((PAGE_KINDS as readonly string[]).includes(kind)) {
      it(`[AC-ENG-015] defaults a missing layout to classic for ${kind}`, () => {
        const migrated = migrateDocument(kind, { schemaVersion: 1, sections: {}, order: [] });
        expect(migrated.layout).toBe("classic");
      });
    } else {
      // Layout is optional (groups) or absent (theme settings) for these kinds: migration never adds one.
      it(`[AC-ENG-015] leaves a missing layout missing for ${kind}`, () => {
        const migrated = migrateDocument(kind, { schemaVersion: 1, sections: {}, order: [] });
        expect(migrated).toEqual({ schemaVersion: 1, sections: {}, order: [] });
        expect("layout" in migrated).toBe(false);
      });
    }

    it(`[AC-ENG-015] keeps a spotlight layout unchanged for ${kind}`, () => {
      const raw = {
        schemaVersion: 1,
        layout: "spotlight",
        sections: { hero: { type: "hero", settings: {}, blocks: {}, block_order: [] } },
        order: ["hero"],
      };
      const once = migrateDocument(kind, raw);
      expect(once).toEqual(raw);
      expect(migrateDocument(kind, once)).toEqual(raw);
    });
  }

  it("[AC-ENG-015] never produces a default layout", () => {
    for (const kind of ALL_KINDS) {
      expect(migrateDocument(kind, { schemaVersion: 1 }).layout).not.toBe("default");
    }
  });

  it("rejects unsupported future schemaVersion", () => {
    const futureDoc = {
      schemaVersion: 999,
      layout: "classic",
      sections: {},
      order: [],
    };

    expect(() => migrateDocument("index", futureDoc)).toThrow(/unsupported schemaVersion/i);
  });

  it("[AC-ENG-015] rejects a missing, non-integer, non-positive or non-number schemaVersion", () => {
    expect(() => migrateDocument("index", {})).toThrow(/unsupported schemaVersion/i);
    expect(() => migrateDocument("index", { sections: {}, order: [] })).toThrow(/unsupported schemaVersion/i);
    for (const schemaVersion of [1.5, -1, 0, NaN, Infinity, "1", null, undefined, true, [], {}]) {
      expect(() => migrateDocument("index", { schemaVersion, sections: {}, order: [] })).toThrow(/unsupported schemaVersion/i);
    }
  });

  it("[AC-ENG-015] rejects inputs that are not a plain object with a clear error", () => {
    for (const raw of [null, undefined, 1, "doc", true, [], [{ schemaVersion: 1 }]]) {
      expect(() => migrateDocument("index", raw)).toThrow(/expected an object/i);
    }
  });

  it("[AC-ENG-015] rejects class instances, Dates, Maps and prototype-carried versions as an invalid document, not a version error", () => {
    class Doc {
      schemaVersion = 1;
      sections = {};
      order = [];
    }
    const inherited = Object.create({ schemaVersion: 1, sections: {}, order: [] });
    const dated = Object.assign(new Date(), { schemaVersion: 1 });
    const mapped = Object.assign(new Map(), { schemaVersion: 1 });
    for (const raw of [new Doc(), inherited, dated, mapped, new Date(), new Map(), /re/, () => 1]) {
      expect(() => migrateDocument("index", raw)).toThrow(/invalid document/i);
    }
    // A null-prototype object is plain data (JSON.parse never makes one, but a hand-built record may be).
    const bare = Object.assign(Object.create(null), { schemaVersion: 1, sections: {}, order: [] });
    expect(migrateDocument("index", bare).layout).toBe("classic");
  });

  it("[AC-ENG-015] fills the default page layout when layout is undefined, null or an empty string, and leaves any other string to the validator", () => {
    for (const kind of ["index", "product", "collection"] as const) {
      for (const layout of [undefined, null, ""]) {
        const migrated = migrateDocument(kind, { schemaVersion: 1, layout, sections: {}, order: [] });
        expect({ kind, layout, result: migrated.layout }).toEqual({ kind, layout, result: "classic" });
      }
      // "default" is clarification C-02's extra value: untouched here, so validation rejects it.
      expect(migrateDocument(kind, { schemaVersion: 1, layout: "default", sections: {}, order: [] }).layout).toBe("default");
      expect(migrateDocument(kind, { schemaVersion: 1, layout: "spotlight", sections: {}, order: [] }).layout).toBe("spotlight");
    }
    // Group and theme documents never get a layout, even from a null or empty one.
    const group = migrateDocument("group_header", { schemaVersion: 1, layout: null, sections: {}, order: [] });
    expect(group.layout).toBeNull();
    expect(migrateDocument("group_footer", { schemaVersion: 1, layout: "", sections: {}, order: [] }).layout).toBe("");
  });
});

describe("Engine Migrate is lossless at schemaVersion 1 [AC-ENG-015]", () => {
  const section = { type: "hero", settings: { heading: "Hi", count: 3, on: true, none: null }, blocks: {}, block_order: [] };
  const SAMPLES: Array<[Parameters<typeof migrateDocument>[0], Record<string, unknown>]> = [
    ["index", { schemaVersion: 1, layout: "classic", sections: { hero: section }, order: ["hero"] }],
    ["product", { schemaVersion: 1, layout: "spotlight", sections: { hero: section }, order: ["hero"] }],
    ["collection", { schemaVersion: 1, layout: "classic", sections: {}, order: [] }],
    [
      "theme_settings",
      {
        schemaVersion: 1,
        settings: { colors: { primary: "#112233" }, typography: { headingFont: "inter", headingWeight: 700 }, social: {} },
      },
    ],
    ["group_header", { schemaVersion: 1, sections: { hero: section }, order: ["hero"] }],
    ["group_footer", { schemaVersion: 1, layout: "classic", sections: {}, order: [] }],
    ["group_announcement", { schemaVersion: 1, sections: {}, order: [] }],
  ];

  for (const [kind, sample] of SAMPLES) {
    it(`[AC-ENG-015] the v1 ${kind} sample round-trips deep-equal and is stable on a second pass`, () => {
      const migrated = migrateDocument(kind, deepFreeze(structuredClone(sample)));
      expect(migrated).toEqual(sample);
      expect(Object.keys(migrated).sort()).toEqual(Object.keys(sample).sort());
      expect(migrateDocument(kind, migrated)).toEqual(sample);
    });
  }

  it("[AC-ENG-015] theme_settings keeps its settings and gains no layout", () => {
    const raw = { schemaVersion: 1, settings: { colors: { primary: "#112233" }, social: {} } };
    const migrated = migrateDocument("theme_settings", raw) as unknown as Record<string, unknown>;
    expect(migrated.settings).toEqual(raw.settings);
    expect("layout" in migrated).toBe(false);
  });

  it("[AC-ENG-015] a group document without layout stays without layout, with and without sections", () => {
    for (const kind of ["group_header", "group_footer", "group_announcement"] as const) {
      for (const raw of [{ schemaVersion: 1 }, { schemaVersion: 1, sections: {}, order: [] }]) {
        const migrated = migrateDocument(kind, raw);
        expect("layout" in migrated).toBe(false);
        expect(migrated).toEqual(raw);
      }
    }
  });

  it("[AC-ENG-015] classic and spotlight layouts are unchanged", () => {
    for (const layout of ["classic", "spotlight"]) {
      expect(migrateDocument("index", { schemaVersion: 1, layout, sections: {}, order: [] }).layout).toBe(layout);
    }
  });

  it("[AC-ENG-015] unknown extra keys, at the root and inside sections, are preserved", () => {
    const raw = {
      schemaVersion: 1,
      layout: "classic",
      futureRootKey: { nested: [1, 2, 3] },
      sections: { hero: { ...section, futureSectionKey: "keep" } },
      order: ["hero"],
    };
    const migrated = migrateDocument("index", raw) as unknown as Record<string, unknown>;
    expect(migrated).toEqual(raw);
    expect(migrated.futureRootKey).toEqual({ nested: [1, 2, 3] });
  });

  it("[AC-ENG-015] does not mutate a deep-frozen input, also when it fills in the page layout", () => {
    const withLayout = deepFreeze({ schemaVersion: 1, layout: "classic", sections: { hero: section }, order: ["hero"] });
    const withoutLayout = deepFreeze({ schemaVersion: 1, sections: { hero: section }, order: ["hero"] });
    const snapshot = JSON.stringify(withoutLayout);
    expect(() => migrateDocument("index", withLayout)).not.toThrow();
    expect(() => migrateDocument("index", withoutLayout)).not.toThrow();
    expect(JSON.stringify(withoutLayout)).toBe(snapshot);
    expect("layout" in withoutLayout).toBe(false);
  });

  it("[AC-ENG-015] always returns a structured clone: never the input and never sharing nested objects", () => {
    const raw = { schemaVersion: 1, layout: "classic", sections: { hero: section }, order: ["hero"] };
    const migrated = migrateDocument("index", raw);
    expect(migrated).not.toBe(raw);
    expect(migrated.sections).not.toBe(raw.sections);
    expect(migrated.sections.hero).not.toBe(raw.sections.hero);
    expect(migrated.order).not.toBe(raw.order);
    (migrated.sections.hero.settings as Record<string, unknown>).heading = "changed";
    expect(raw.sections.hero.settings.heading).toBe("Hi");
  });
});

describe("Engine Migrate is chain-ready [AC-ENG-015]", () => {
  const rename = (doc: Record<string, unknown>) => {
    const { oldKey, ...rest } = doc;
    return { ...rest, newKey: oldKey };
  };

  it("[AC-ENG-015] the shipped step table is empty today, and holds a step for every version below the current one", () => {
    // Today CURRENT is 1, so there is nothing to migrate from. Bumping DOCUMENT_SCHEMA_VERSION without adding the
    // matching step makes this fail: a version-N document must always be able to reach the current version.
    expect(DOCUMENT_SCHEMA_VERSION).toBe(1);
    expect(Object.keys(MIGRATION_STEPS)).toEqual([]);
    for (let version = 1; version < DOCUMENT_SCHEMA_VERSION; version++) {
      expect(typeof MIGRATION_STEPS[version]).toBe("function");
    }
    expect(Object.keys(MIGRATION_STEPS)).toHaveLength(DOCUMENT_SCHEMA_VERSION - 1);
    expect(Object.isFrozen(MIGRATION_STEPS)).toBe(true);
    // The identity case of the real table: a current-version document needs no step.
    const doc = { schemaVersion: DOCUMENT_SCHEMA_VERSION, layout: "classic", sections: {}, order: [] };
    expect(applyMigrationSteps(doc, DOCUMENT_SCHEMA_VERSION, DOCUMENT_SCHEMA_VERSION, MIGRATION_STEPS)).toEqual(doc);
  });

  it("[AC-ENG-015] a fake step 1 -> 2 runs, stamps the new version and keeps every other key", () => {
    const doc = { schemaVersion: 1, oldKey: "v", extra: [1], sections: {}, order: [] };
    const out = applyMigrationSteps(doc, 1, 2, { 1: rename });
    expect(out).toEqual({ schemaVersion: 2, newKey: "v", extra: [1], sections: {}, order: [] });
    expect(doc).toEqual({ schemaVersion: 1, oldKey: "v", extra: [1], sections: {}, order: [] });
  });

  it("[AC-ENG-015] steps run in order from the document's own version up to the target", () => {
    const calls: number[] = [];
    const steps = {
      1: (d: Record<string, unknown>) => (calls.push(1), { ...d, a: 1 }),
      2: (d: Record<string, unknown>) => (calls.push(2), { ...d, b: 2 }),
      3: (d: Record<string, unknown>) => (calls.push(3), { ...d, c: 3 }),
    };
    expect(applyMigrationSteps({ schemaVersion: 2 }, 2, 4, steps)).toEqual({ schemaVersion: 4, b: 2, c: 3 });
    expect(calls).toEqual([2, 3]);
  });

  it("[AC-ENG-015] a step that returns a non-object is a clear error, never a silent { schemaVersion } document", () => {
    for (const bad of [undefined, null, [], [{ a: 1 }], 7, "doc", true]) {
      const steps = { 1: (() => bad) as unknown as (d: Record<string, unknown>) => Record<string, unknown> };
      expect(() => applyMigrationSteps({ schemaVersion: 1, keep: "me" }, 1, 2, steps)).toThrow(/migration step from schemaVersion 1 .*object/i);
    }
    // A later step is held to the same rule, and the input is still untouched.
    const input = { schemaVersion: 1, keep: "me" };
    const chain = { 1: (d: Record<string, unknown>) => d, 2: () => undefined as unknown as Record<string, unknown> };
    expect(() => applyMigrationSteps(input, 1, 3, chain)).toThrow(/schemaVersion 2 .*object/i);
    expect(input).toEqual({ schemaVersion: 1, keep: "me" });
  });

  it("[AC-ENG-015] a gap in the step table is a clear error, never a silent skip", () => {
    expect(() => applyMigrationSteps({ schemaVersion: 1 }, 1, 3, { 1: (d) => d })).toThrow(/no migration step from schemaVersion 2/i);
  });
});
