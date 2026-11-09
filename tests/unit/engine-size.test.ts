import { describe, expect, it } from "vitest";
import { jsonbByteLength, UnstorableTextError, ValueDepthError } from "../../lib/templates/engine/size";
import { utf8ByteLength, validateDocument } from "../../lib/templates/engine/validate";
import { LIMITS } from "../../lib/templates/limits";
import { getRegistry } from "../../lib/templates/registry/index";

// The database CHECK measures octet_length(document::text) on JSONB (D6). jsonb text puts ": " after keys and
// ", " between elements, and prints {} / [] for empty containers. Expected counts below are written out by hand
// from that text form; the PGlite test (tests/db/templates-size.test.ts) proves them against the real database.
describe("jsonbByteLength measures the jsonb text form [AC-ENG-006]", () => {
  const cases: { label: string; value: unknown; text: string }[] = [
    { label: "empty object", value: {}, text: "{}" },
    { label: "empty array", value: [], text: "[]" },
    { label: "one key", value: { a: 1 }, text: '{"a": 1}' },
    { label: "two keys", value: { a: 1, b: 2 }, text: '{"a": 1, "b": 2}' },
    { label: "array of numbers", value: [1, 2, 3], text: "[1, 2, 3]" },
    { label: "nested", value: { a: [1, { b: [] }], c: {} }, text: '{"a": [1, {"b": []}], "c": {}}' },
    { label: "scalars", value: [true, false, null, "x"], text: '[true, false, null, "x"]' },
    { label: "string escapes", value: { s: 'q"\\\n\t\u0001' }, text: '{"s": "q\\"\\\\\\n\\t\\u0001"}' },
    { label: "unicode (2, 3 and 4 byte characters)", value: ["é", "€", "\u{1F600}"], text: '["é", "€", "\u{1F600}"]' },
    { label: "negative and decimal numbers", value: [-1, 0.5, -0.25, 12.75], text: "[-1, 0.5, -0.25, 12.75]" },
    { label: "negative zero is 0", value: [-0], text: "[0]" },
    { label: "exponent form is expanded (1e21)", value: [1e21], text: "[1000000000000000000000]" },
    { label: "exponent form is expanded (1.5e-7)", value: [1.5e-7], text: "[0.00000015]" },
    { label: "a number with a point inside the digits (123.456)", value: [123.456], text: "[123.456]" },
    { label: "non-finite numbers are null", value: [Number.NaN, Number.POSITIVE_INFINITY], text: "[null, null]" },
    { label: "undefined is dropped from objects and null in arrays", value: { a: undefined, b: [undefined, () => 1], c: 1 }, text: '{"b": [null, null], "c": 1}' },
    { label: "toJSON is honoured", value: { d: new Date(0) }, text: '{"d": "1970-01-01T00:00:00.000Z"}' },
  ];

  for (const { label, value, text } of cases) {
    it(`[AC-ENG-006] ${label}`, () => {
      expect(jsonbByteLength(value)).toBe(utf8ByteLength(text));
    });
  }

  it("[AC-ENG-006] exact byte counts on small documents (spelled out)", () => {
    expect(jsonbByteLength({})).toBe(2);
    expect(jsonbByteLength({ a: 1 })).toBe(8); // {"a": 1}
    expect(jsonbByteLength({ a: 1, b: 2 })).toBe(16); // {"a": 1, "b": 2}
    expect(jsonbByteLength([1, 2, 3])).toBe(9); // [1, 2, 3]
    expect(jsonbByteLength({ k: "é" })).toBe(11); // {"k": "é"} is 10 characters, 11 bytes
  });

  it("[AC-ENG-006] a root that JSON.stringify omits counts as 0, a bigint or a cycle throws", () => {
    expect(jsonbByteLength(undefined)).toBe(0);
    expect(() => jsonbByteLength({ n: BigInt(1) })).toThrow(TypeError);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => jsonbByteLength(cyclic)).toThrow(TypeError);
    const shared = { x: 1 };
    expect(jsonbByteLength({ a: shared, b: shared })).toBe(utf8ByteLength('{"a": {"x": 1}, "b": {"x": 1}}'));
  });

  // Rewritten assertion: this used to assert that a 200,000-deep array is MEASURED iteratively. The approved
  // behaviour changed (round 3, item 1): a value nested deeper than LIMITS.maxValueDepth is refused with a
  // dedicated error, because such a value can never be serialized or cloned by the save path (JSON.stringify and
  // structuredClone recurse). It still never overflows the call stack: the error is thrown iteratively.
  it("[AC-ENG-006] a structure 200,000 levels deep throws ValueDepthError without overflowing the call stack", () => {
    let deep: unknown = [];
    for (let i = 0; i < 200_000; i++) deep = [deep];
    expect(() => jsonbByteLength(deep)).toThrow(ValueDepthError);
  });

  /** `levels` nested arrays, the innermost one holding one number (so the innermost level is not empty). */
  const nestedArrays = (levels: number): unknown => {
    let value: unknown = [1];
    for (let i = 1; i < levels; i++) value = [value];
    return value;
  };

  it("[AC-ENG-006] LIMITS.maxValueDepth is 64: depth exactly at the limit is measured exactly, one level deeper throws", () => {
    expect(LIMITS.maxValueDepth).toBe(64);
    const atLimit = nestedArrays(LIMITS.maxValueDepth);
    // 64 pairs of brackets around "1".
    expect(jsonbByteLength(atLimit)).toBe(2 * 64 + 1);
    expect(jsonbByteLength(atLimit)).toBe(utf8ByteLength(JSON.stringify(atLimit)));
    expect(() => jsonbByteLength(nestedArrays(LIMITS.maxValueDepth + 1))).toThrow(ValueDepthError);
    expect(() => jsonbByteLength(nestedArrays(LIMITS.maxValueDepth + 1))).toThrow(TypeError);
  });

  it("[AC-ENG-006] the depth limit counts objects and mixed nesting the same way, and an empty container counts as a level", () => {
    const objects = (levels: number): unknown => {
      let value: unknown = { k: 1 };
      for (let i = 1; i < levels; i++) value = { k: value };
      return value;
    };
    expect(jsonbByteLength(objects(64))).toBe('{"k": '.length * 64 + 1 + 64);
    expect(() => jsonbByteLength(objects(65))).toThrow(ValueDepthError);
    // 64 levels whose innermost level is an empty array: still at the limit; an empty array as level 65: over.
    let atLimit: unknown = [];
    for (let i = 1; i < 64; i++) atLimit = [atLimit];
    expect(jsonbByteLength(atLimit)).toBe(2 * 64);
    expect(() => jsonbByteLength([atLimit])).toThrow(ValueDepthError);
  });

  it("[AC-ENG-006] shared (non-cyclic) references and wide values are not mistaken for depth", () => {
    const shared = nestedArrays(30);
    expect(() => jsonbByteLength({ a: shared, b: shared, c: [shared, shared] })).not.toThrow();
  });

  it("[AC-ENG-006] NUL and unpaired surrogates in a string or a key throw UnstorableTextError", () => {
    const nul = String.fromCharCode(0);
    const high = String.fromCharCode(0xd800);
    const low = String.fromCharCode(0xdc00);
    // `${low}${high}` is the wrong way round (a pair is high then low); the last one has a lone high first.
    for (const text of [`a${nul}b`, nul, `x${high}`, `${high}y`, `${low}`, `${low}${high}`, `${high}${high}${low}x${low}`]) {
      expect(() => jsonbByteLength({ k: text })).toThrow(UnstorableTextError);
      expect(() => jsonbByteLength({ [text]: 1 })).toThrow(UnstorableTextError);
      expect(() => jsonbByteLength([text])).toThrow(TypeError);
    }
    expect(() => jsonbByteLength(`ok${nul}`)).toThrow(UnstorableTextError);
  });

  it("[AC-ENG-006] unstorable text never stops the cycle and depth guards: a cycle or a deep value wins, in either order", () => {
    const nul = String.fromCharCode(0);
    const cyclic: Record<string, unknown> = { n: `a${nul}` };
    cyclic.self = cyclic;
    // Text first, cycle later (key order n, self) and cycle first, text later: always the cycle error.
    for (const value of [cyclic, { self: cyclic, n: nul }, [nul, cyclic]]) {
      let error: unknown;
      try {
        jsonbByteLength(value);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(TypeError);
      expect(error).not.toBeInstanceOf(UnstorableTextError);
      expect(String((error as Error).message)).toMatch(/circular/i);
    }
    const deepArray = (levels: number): unknown => {
      let value: unknown = [1];
      for (let i = 1; i < levels; i++) value = [value];
      return value;
    };
    expect(() => jsonbByteLength({ a: nul, b: deepArray(200) })).toThrow(ValueDepthError);
    expect(() => jsonbByteLength({ a: deepArray(200), b: nul })).toThrow(ValueDepthError);
    expect(() => jsonbByteLength({ [nul]: 1, b: deepArray(200) })).toThrow(ValueDepthError);
    // Text alone is still UnstorableTextError, reported after the whole traversal succeeded.
    expect(() => jsonbByteLength({ a: nul, b: deepArray(10), c: [1, 2] })).toThrow(UnstorableTextError);
    expect(() => jsonbByteLength({ a: nul, n: BigInt(1) })).toThrow(/BigInt/);
  });

  it("[AC-ENG-006] valid surrogate pairs and other control characters are still measured", () => {
    const emoji = String.fromCodePoint(0x1f600);
    expect(jsonbByteLength([emoji])).toBe(utf8ByteLength(`["${emoji}"]`));
    const controls = [1, 0x1f, 0x7f, 0x2028, 0x2029, 0x85, 0xfeff].map((c) => String.fromCharCode(c)).join("");
    expect(() => jsonbByteLength({ controls })).not.toThrow();
  });

  it("[AC-ENG-006] it is always at least the compact JSON.stringify size", () => {
    const doc = { a: [1, { b: "x", c: [] }], d: { e: {}, f: [true, null] }, g: "h" };
    expect(jsonbByteLength(doc)).toBeGreaterThanOrEqual(utf8ByteLength(JSON.stringify(doc)));
  });
});

describe("validateDocument applies the jsonb size [AC-ENG-006]", () => {
  const registry = getRegistry();
  // One unknown section whose settings hold a padding string: the document is otherwise valid (a warning only).
  const withPadding = (padding: number) => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { s: { type: "ghost", settings: { pad: "x".repeat(padding) }, blocks: {}, block_order: [] } },
    order: ["s"],
  });

  it("[AC-ENG-006] a document at exactly the limit passes and one byte more fails with DOCUMENT_SIZE_EXCEEDED", () => {
    const fixed = jsonbByteLength(withPadding(0));
    const atLimit = withPadding(LIMITS.maxDocumentBytes - fixed);
    expect(jsonbByteLength(atLimit)).toBe(LIMITS.maxDocumentBytes);
    expect(validateDocument("index", atLimit, registry).ok).toBe(true);

    const over = withPadding(LIMITS.maxDocumentBytes - fixed + 1);
    expect(jsonbByteLength(over)).toBe(LIMITS.maxDocumentBytes + 1);
    const res = validateDocument("index", over, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("DOCUMENT_SIZE_EXCEEDED");
  });

  it("[AC-ENG-006] a document that is under the limit compact but over it as jsonb is refused (the reviewer's probe)", () => {
    // Many small keys: compact JSON is far smaller than the jsonb text form.
    const settings: Record<string, unknown> = {};
    for (let i = 0; i < 23_000; i++) settings[`k${i}`] = i % 10;
    const doc = {
      schemaVersion: 1,
      layout: "classic",
      sections: { s: { type: "ghost", settings, blocks: {}, block_order: [] } },
      order: ["s"],
    };
    expect(utf8ByteLength(JSON.stringify(doc))).toBeLessThan(LIMITS.maxDocumentBytes);
    expect(jsonbByteLength(doc)).toBeGreaterThan(LIMITS.maxDocumentBytes);
    const res = validateDocument("index", doc, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("DOCUMENT_SIZE_EXCEEDED");
  });
});
