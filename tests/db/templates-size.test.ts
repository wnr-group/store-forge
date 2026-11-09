import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jsonbByteLength } from "@/lib/templates/engine/size";
import { validateDocument } from "@/lib/templates/engine/validate";
import { LIMITS } from "@/lib/templates/limits";
import { getRegistry } from "@/lib/templates/registry/index";
import { createDb, createUser, onboard } from "./harness";
import { failure, insertTemplate, publish } from "./template-fixtures";

/**
 * The app's 256 KB check must agree with the database CHECK `octet_length(document::text) <= 262144`, which
 * measures the JSONB text form ("key": value, ", " between elements, {} and [] for empties). The engine's
 * `jsonbByteLength` is compared with the real database byte for byte, then the boundary is probed on both sides.
 */
let db: PGlite;
let tenantId: string;
let storeId: string;
const registry = getRegistry();

const dbSize = async (value: unknown): Promise<number> => {
  const r = await db.query<{ n: number }>("select octet_length($1::jsonb::text)::int as n", [JSON.stringify(value)]);
  return r.rows[0].n;
};

beforeAll(async () => {
  db = await createDb();
  const user = await createUser(db, "size@example.test");
  const provisioned = await onboard(db, user, "size-shop");
  tenantId = provisioned.tenant_id;
  storeId = provisioned.store_id;
});
afterAll(async () => {
  await db.close();
});

const DOCUMENTS: Record<string, unknown> = {
  "empty object": {},
  "empty array": [],
  "empty containers inside": { a: {}, b: [], c: [{}, []] },
  "nested arrays and objects": { a: [1, [2, [3, { b: [4, { c: [] }] }]], { d: { e: { f: [true, null] } } }], g: {} },
  "booleans and null": { t: true, f: false, n: null, list: [true, false, null] },
  "integers": [0, 1, -1, 7, 1234567890123, 2 ** 53, -(2 ** 53), 100, 1000000],
  "decimals": [0.1, 0.5, -0.25, 3.14159, 123.456, 0.000001, 99.99, 1 / 3, 2 / 3],
  "negative zero": [-0, 0],
  "exponent forms (large)": [1e21, 1e22, 1.2345e25, -1e21, 1e100, 1.5e300, 1.7976931348623157e308],
  "exponent forms (small)": [1e-7, 1.5e-7, 1.234e-10, 5e-324, 2.2250738585072014e-308, -1e-9],
  "near the exponent switch": [1e20, 123456789012345680000, 999999999999999900000, 0.000001, 0.0000001],
  "unicode strings": ["é", "€", "漢字", "\u{1F600}", "a\u{1F600}b", "Ünïcödé", "\u2028\u2029", "\u007f"],
  "string escapes": ['q"uote', "back\\slash", "new\nline", "tab\there", "cr\rhere", "ff\fhere", "bs\bhere", "\u0001\u001f", "/slash"],
  "unicode and escaped keys": { é: 1, "漢字": [1], 'k"q': 2, "k\\b": 3, "k\nn": 4, "": 5, " ": 6 },
  "many small keys": Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`key_${i}`, i % 7])),
  "a template-shaped document": {
    schemaVersion: 1,
    layout: "classic",
    sections: { s1: { type: "hero", settings: { heading: "Hi", image: { path: "t/store/a.png", focal: { x: 50, y: 25.5 } } }, blocks: {}, block_order: [] } },
    order: ["s1"],
  },
};

describe("engine size equals database size [AC-ENG-006]", () => {
  for (const [label, value] of Object.entries(DOCUMENTS)) {
    it(`[AC-ENG-006] ${label}: jsonbByteLength equals octet_length(document::jsonb::text)`, async () => {
      expect(jsonbByteLength(value)).toBe(await dbSize(value));
    });
  }

  // Changed from 500 levels: the approved behaviour changed (round 3, item 1). The engine now refuses values
  // nested deeper than LIMITS.maxValueDepth, so the equality is checked up to exactly that depth, and the
  // refusal of a deeper one is asserted next to it (the database itself would still store 500 levels).
  it("[AC-ENG-006] a deeply nested array (exactly LIMITS.maxValueDepth levels) is measured the same way", async () => {
    let deep: unknown = [];
    for (let i = 1; i < LIMITS.maxValueDepth; i++) deep = [deep, i];
    expect(jsonbByteLength(deep)).toBe(await dbSize(deep));
  });

  it("[AC-ENG-006] one level deeper than LIMITS.maxValueDepth is refused by the app although the database would store it", async () => {
    let deep: unknown = [];
    for (let i = 0; i < LIMITS.maxValueDepth; i++) deep = [deep, i];
    expect(await dbSize(deep)).toBeGreaterThan(0);
    expect(() => jsonbByteLength(deep)).toThrow(/nested deeper/);
  });

  it("[AC-ENG-006] the reviewer's probe: a 261 KB compact document is far larger as jsonb, and both sides see the same number", async () => {
    const settings: Record<string, unknown> = {};
    for (let i = 0; i < 23_000; i++) settings[`k${i}`] = i % 10;
    const probe = { schemaVersion: 1, layout: "classic", sections: { s: { type: "ghost", settings, blocks: {}, block_order: [] } }, order: ["s"] };
    const compact = Buffer.byteLength(JSON.stringify(probe), "utf8");
    const jsonb = await dbSize(probe);
    expect(compact).toBeLessThan(LIMITS.maxDocumentBytes);
    expect(jsonb).toBeGreaterThan(LIMITS.maxDocumentBytes);
    expect(jsonbByteLength(probe)).toBe(jsonb);
  });
});

/**
 * Text PostgreSQL jsonb refuses (NUL, unpaired surrogates) must be refused by validateDocument too, with a clean
 * UNSUPPORTED_TEXT issue instead of a raw database error. The rule is only as wide as what the database refuses:
 * emoji (valid pairs) and the other control characters are accepted by both. Strings are built with
 * String.fromCharCode so no raw NUL or surrogate sits in this file; JSON.stringify writes them as escapes.
 */
describe("text the database cannot store is refused by the app too [AC-ENG-006]", () => {
  const ch = (code: number) => String.fromCharCode(code);
  const asDocument = (settings: Record<string, unknown>) => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { s: { type: "ghost", settings, blocks: {}, block_order: [] } },
    order: ["s"],
  });
  const dbAccepts = async (value: unknown): Promise<boolean> => {
    try {
      await db.query("select $1::jsonb as v", [JSON.stringify(value)]);
      return true;
    } catch {
      return false;
    }
  };
  const appCodes = (value: unknown) => validateDocument("index", value, registry).issues.map((i) => i.code);

  const refused: [string, Record<string, unknown>][] = [
    ["NUL in a value", { x: `a${ch(0)}b` }],
    ["NUL in a key", { [`a${ch(0)}b`]: 1 }],
    ["a lone high surrogate in a value", { x: `a${ch(0xd800)}b` }],
    ["a lone high surrogate at the end of a value", { x: `a${ch(0xdbff)}` }],
    ["a lone low surrogate in a value", { x: `a${ch(0xdc00)}b` }],
    ["a lone low surrogate in a key", { [`a${ch(0xdfff)}`]: 1 }],
    ["a lone high surrogate in a key", { [`${ch(0xd800)}x`]: 1 }],
    ["a reversed pair (low then high)", { x: `${ch(0xdc00)}${ch(0xd800)}` }],
  ];
  for (const [label, settings] of refused) {
    it(`[AC-ENG-006] ${label}: the database refuses the insert and validateDocument returns UNSUPPORTED_TEXT`, async () => {
      const draft = asDocument(settings);
      expect(await dbAccepts(draft)).toBe(false);
      const error = await failure(insertTemplate(db, { tenantId, storeId, kind: "index", name: "unstorable", draft }));
      expect(error).not.toBe("");
      expect(error).toMatch(/unsupported Unicode escape sequence|invalid input syntax for type json|surrogate/i);
      const res = validateDocument("index", draft, registry);
      expect(res.ok).toBe(false);
      expect(res.issues).toContainEqual({
        path: "",
        code: "UNSUPPORTED_TEXT",
        message: "Text cannot contain NUL characters or unpaired surrogates",
        level: "error",
      });
    });
  }

  const accepted: [string, Record<string, unknown>][] = [
    ["an emoji (valid surrogate pair) in a value and a key", { x: `a${String.fromCodePoint(0x1f600)}b`, [`k${String.fromCodePoint(0x1f600)}`]: 1 }],
    ["a pair at the edges of a string", { x: `${ch(0xd83d)}${ch(0xde00)}${ch(0xd83d)}${ch(0xde00)}` }],
    ["\\u0001 and \\u001f", { x: `a${ch(1)}b${ch(0x1f)}`, [`k${ch(1)}`]: 1 }],
    ["\\u007f", { x: `a${ch(0x7f)}b`, [`k${ch(0x7f)}`]: 1 }],
    ["\\u2028 and \\u2029", { x: `a${ch(0x2028)}b${ch(0x2029)}`, [`k${ch(0x2028)}`]: 1 }],
    ["C1 controls and the byte order mark", { x: `${ch(0x80)}${ch(0x85)}${ch(0x9f)}${ch(0xfeff)}` }],
    ["tab, newline and carriage return", { x: "a\tb\nc\rd" }],
    ["U+FFFE and U+FFFF", { x: `${ch(0xfffe)}${ch(0xffff)}` }],
  ];
  for (const [label, settings] of accepted) {
    it(`[AC-ENG-006] ${label}: accepted by the database and by validateDocument`, async () => {
      const draft = asDocument(settings);
      expect(await dbAccepts(draft)).toBe(true);
      expect(appCodes(draft)).not.toContain("UNSUPPORTED_TEXT");
      expect(appCodes(draft)).not.toContain("SERIALIZATION_ERROR");
      expect(validateDocument("index", draft, registry).ok).toBe(true);
      expect(jsonbByteLength(draft)).toBe(await dbSize(draft));
    });
  }
});

describe("the 256 KB boundary behaves identically in the app and the database [AC-ENG-006]", () => {
  // One unknown section holding a padding string: valid for the engine (an unknown type only warns).
  const withPadding = (padding: number) => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { s: { type: "ghost", settings: { pad: "x".repeat(padding) }, blocks: {}, block_order: [] } },
    order: ["s"],
  });
  const baseBytes = jsonbByteLength(withPadding(0));

  it("[AC-ENG-006] a document measuring exactly 262144 bytes passes both: validateDocument ok and the CHECK accepts the insert", async () => {
    const atLimit = withPadding(LIMITS.maxDocumentBytes - baseBytes);
    expect(await dbSize(atLimit)).toBe(262_144);
    expect(jsonbByteLength(atLimit)).toBe(262_144);
    expect(validateDocument("index", atLimit, registry).ok).toBe(true);

    const id = await insertTemplate(db, { tenantId, storeId, kind: "index", name: "at limit", draft: atLimit });
    expect(id).toBeTruthy();
    const templateId = await insertTemplate(db, { tenantId, storeId, kind: "product", name: "at limit version", draft: withPadding(0) });
    expect(await publish(db, { tenantId, storeId, templateId, document: atLimit })).toBeTruthy();
  });

  it("[AC-ENG-006] a document measuring 262145 bytes fails both: DOCUMENT_SIZE_EXCEEDED and a CHECK violation", async () => {
    const over = withPadding(LIMITS.maxDocumentBytes - baseBytes + 1);
    expect(await dbSize(over)).toBe(262_145);
    expect(jsonbByteLength(over)).toBe(262_145);
    const res = validateDocument("index", over, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("DOCUMENT_SIZE_EXCEEDED");

    const insertError = await failure(insertTemplate(db, { tenantId, storeId, kind: "collection", name: "over limit", draft: over }));
    expect(insertError).toMatch(/templates_draft_check/);
    const templateId = await insertTemplate(db, { tenantId, storeId, kind: "collection", name: "over limit version", draft: withPadding(0) });
    expect(await failure(publish(db, { tenantId, storeId, templateId, document: over }))).toMatch(/template_versions_document_check/);
  });

  it("[AC-ENG-006] a many-small-keys document the compact form would let through is refused by the app before the database sees it", async () => {
    const settings: Record<string, unknown> = {};
    for (let i = 0; i < 23_000; i++) settings[`k${i}`] = i % 10;
    const wide = { schemaVersion: 1, layout: "classic", sections: { s: { type: "ghost", settings, blocks: {}, block_order: [] } }, order: ["s"] };
    expect(Buffer.byteLength(JSON.stringify(wide), "utf8")).toBeLessThan(LIMITS.maxDocumentBytes);
    const res = validateDocument("index", wide, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("DOCUMENT_SIZE_EXCEEDED");
    expect(await failure(insertTemplate(db, { tenantId, storeId, kind: "index", name: "wide", draft: wide }))).toMatch(/templates_draft_check/);
  });
});
