import { describe, expect, it } from "vitest";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import type { ComponentRegistry } from "../../lib/templates/engine/descriptors";
import { imageValueSchema } from "../../lib/templates/engine/schema";
import { validateDocument } from "../../lib/templates/engine/validate";

// Unicode format/control characters and percent-encoding forms in image paths [AC-ENG-016].
const T = "tenant-a";
const own = (name: string) => `${T}/store/${name}`;
const registry: ComponentRegistry = {
  sections: { hero: { type: "hero", name: "Hero", settings: [{ id: "image", type: "image", label: "Image", default: null }] } },
  blocks: {},
};

function docWith(path: string): TemplateDocument {
  const s1: ComponentNode = { type: "hero", settings: { image: { path } }, blocks: {}, block_order: [] };
  return { schemaVersion: 1, layout: "classic", sections: { s1 }, order: ["s1"] };
}
function accepted(path: string): boolean {
  const viaSchema = imageValueSchema(T).safeParse({ path }).success;
  const viaDoc = validateDocument("index", docWith(path), registry, { tenantId: T }).ok;
  expect({ path, viaDoc }).toEqual({ path, viaDoc: viaSchema });
  return viaSchema;
}
function rejectedWithCode(path: string): void {
  expect(imageValueSchema(T).safeParse({ path }).success).toBe(false);
  const res = validateDocument("index", docWith(path), registry, { tenantId: T });
  expect(res.ok).toBe(false);
  expect(res.issues.some((i) => i.code === "CROSS_TENANT_PATH" && i.path === "sections.s1.settings.image")).toBe(true);
}

/** Code points covered by the \p{Cc}, \p{Cf}, \p{Zl} and \p{Zp} rule that the old explicit list missed or listed. */
const FORBIDDEN_CODE_POINTS: [string, number][] = [
  ["ARABIC LETTER MARK U+061C", 0x061c],
  ["SOFT HYPHEN U+00AD", 0x00ad],
  ["LINE SEPARATOR U+2028", 0x2028],
  ["PARAGRAPH SEPARATOR U+2029", 0x2029],
  ["WORD JOINER U+2060", 0x2060],
  ["FUNCTION APPLICATION U+2061", 0x2061],
  ["INVISIBLE TIMES U+2062", 0x2062],
  ["INVISIBLE SEPARATOR U+2063", 0x2063],
  ["INVISIBLE PLUS U+2064", 0x2064],
  ["INHIBIT SYMMETRIC SWAPPING U+206A", 0x206a],
  ["NOMINAL DIGIT SHAPES U+206F", 0x206f],
  ["MONGOLIAN VOWEL SEPARATOR U+180E", 0x180e],
  ["INTERLINEAR ANNOTATION ANCHOR U+FFF9", 0xfff9],
  ["INTERLINEAR ANNOTATION TERMINATOR U+FFFB", 0xfffb],
  ["TAG U+E0001", 0xe0001],
  ["TAG LATIN SMALL LETTER A U+E0061", 0xe0061],
  ["CANCEL TAG U+E007F", 0xe007f],
  // Already rejected before: must stay rejected.
  ["ZERO WIDTH SPACE U+200B", 0x200b],
  ["RIGHT-TO-LEFT OVERRIDE U+202E", 0x202e],
  ["BOM U+FEFF", 0xfeff],
  ["C1 U+0085", 0x85],
];

describe("image paths reject every Unicode control and format character [AC-ENG-016]", () => {
  for (const [label, cp] of FORBIDDEN_CODE_POINTS) {
    it(`[AC-ENG-016] rejects ${label} inside and at both ends of a same-tenant file name`, () => {
      const ch = String.fromCodePoint(cp);
      rejectedWithCode(own(`a${ch}b.png`));
      rejectedWithCode(own(`${ch}a.png`));
      rejectedWithCode(own(`a.png${ch}`));
    });
  }

  it("[AC-ENG-016] still accepts ordinary Unicode letters, digits and spaces", () => {
    for (const name of ["café.png", "写真.png", "naïve résumé.png", "Ünïcödé-1.webp", "emoji\u{1F600}.png"]) {
      expect({ name, ok: accepted(own(name)) }).toEqual({ name, ok: true });
    }
  });
});

describe("percent-encoding is an allowlist [AC-ENG-016]", () => {
  const REJECTED: [string, string][] = [
    ["overlong dot (3 bytes)", "%e0%80%ae"],
    ["overlong dot (4 bytes)", "%f0%80%80%ae"],
    ["overlong dot (2 bytes)", "%c0%ae"],
    ["overlong dot (2 bytes, upper)", "%C0%AE"],
    ["IIS-style %u escape", "%u002e"],
    ["lone percent", "%"],
    ["trailing percent", "a%"],
    ["one hex digit", "%2"],
    ["non-hex digits", "%zz"],
    ["encoded dots", "%2e%2e"],
    ["double-encoded dot", "%252e"],
    ["triple-encoded dot", "%25252e"],
    ["lone continuation byte", "%80"],
    ["truncated 3-byte sequence", "%e0%80"],
    ["invalid byte", "%ff"],
    ["encoded UTF-16 surrogate", "%ed%a0%80"],
    ["literal percent after a second decode", "100%25"],
    ["double-encoded junk", "%25zz"],
    ["encoded slash", "a%2fb"],
    ["encoded backslash", "a%5cb"],
    ["encoded NUL", "a%00b"],
    ["encoded line separator", "a%e2%80%a8b"],
    ["encoded right-to-left override", "a%e2%80%aeb"],
    ["encoded BOM", "a%ef%bb%bfb"],
    ["encoded soft hyphen", "a%c2%adb"],
    ["encoded fullwidth dot", "%ef%bc%8e%ef%bc%8e"],
    ["fullwidth percent signs forming an overlong dot", String.fromCodePoint(0xff05) + "e0" + String.fromCodePoint(0xff05) + "80" + String.fromCodePoint(0xff05) + "ae"],
  ];
  for (const [label, enc] of REJECTED) {
    it(`[AC-ENG-016] rejects ${label}: ${enc}`, () => {
      rejectedWithCode(own(`x${enc}.png`));
      rejectedWithCode(own(enc));
    });
  }

  const ACCEPTED: [string, string][] = [
    ["an encoded space", "a%20b.png"],
    ["an encoded space, only the name", "%20.png"],
    ["encoded e-acute (upper)", "caf%C3%A9.png"],
    ["encoded e-acute (lower)", "caf%c3%a9.png"],
    ["encoded CJK", "%E5%86%99%E7%9C%9F.png"],
    ["a doubly encoded name that decodes cleanly", "%2541.png"],
    ["a plain name", "plain.png"],
  ];
  for (const [label, name] of ACCEPTED) {
    it(`[AC-ENG-016] accepts ${label}: ${name}`, () => {
      expect({ name, ok: accepted(own(name)) }).toEqual({ name, ok: true });
    });
  }

  it("[AC-ENG-016] the decoded form is checked against every rule, not just the encoded one", () => {
    // Encoded "..", a path segment of dots, a decoded separator or an empty segment all fail after decoding.
    for (const bad of ["%2E%2e/a.png", "a%2F..%2Fb.png", "a/%2e/b.png", "a//b%20c.png"]) rejectedWithCode(own(bad));
  });
});
