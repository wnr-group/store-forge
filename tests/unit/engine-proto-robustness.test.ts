import { describe, expect, it } from "vitest";
import { TEMPLATE_KINDS, type TemplateKind } from "../../lib/templates/document";
import { validateDocument, type Issue } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";

// Final-review fix 1: `JSON.parse` creates a real own `__proto__` key, which Zod's z.record silently drops, so
// the nodes stored under it used to reach the tree walk unvalidated (a TypeError, or an ok:true verdict for a
// schema-invalid node). Every input below is built with JSON.parse the way a stored document would be.
const registry = getRegistry();
const T = "tenant-a";
const PAGE_KINDS: TemplateKind[] = ["index", "product", "collection"];

const parse = (text: string): unknown => JSON.parse(text);

const rootOf = (kind: TemplateKind, body: string): string => {
  if (kind === "theme_settings") return `{"schemaVersion":1,${body}}`;
  const layout = PAGE_KINDS.includes(kind) ? ',"layout":"classic"' : "";
  return `{"schemaVersion":1${layout},${body}}`;
};

const errorsOf = (issues: Issue[]) => issues.filter((i) => i.level === "error");

/** Node values that are not valid components: every one of them must be reported, never thrown on, never accepted. */
const BAD_NODES: Record<string, string> = {
  null: "null",
  number: "7",
  string: '"x"',
  boolean: "true",
  array: "[]",
  "empty object": "{}",
  "bad field types": '{"type":7,"settings":null,"blocks":null,"block_order":5}',
  "empty type": '{"type":"","settings":{},"blocks":{},"block_order":[]}',
  "settings is an array": '{"type":"hero","settings":[],"blocks":{},"block_order":[]}',
  "blocks is an array": '{"type":"hero","settings":{},"blocks":[],"block_order":[]}',
  "block_order holds a number": '{"type":"hero","settings":{},"blocks":{},"block_order":[1]}',
  "disabled is a string": '{"type":"hero","settings":{},"blocks":{},"block_order":[],"disabled":"no"}',
};

const GOOD_HERO = '{"type":"hero","settings":{},"blocks":{},"block_order":[]}';

/** Documents that hide `node` under an own `__proto__` key at the section, block and nested-block level. */
function hiddenNodeDocs(kind: TemplateKind, node: string): Record<string, string> {
  return {
    "section __proto__": rootOf(kind, `"sections":{"__proto__":${node}},"order":["__proto__"]`),
    "section __proto__ without order": rootOf(kind, `"sections":{"__proto__":${node}},"order":[]`),
    "block __proto__": rootOf(
      kind,
      `"sections":{"s":{"type":"hero","settings":{},"blocks":{"__proto__":${node}},"block_order":["__proto__"]}},"order":["s"]`,
    ),
    "nested block __proto__": rootOf(
      kind,
      `"sections":{"s":{"type":"hero","settings":{},"blocks":{"b":{"type":"card","settings":{},"blocks":{"__proto__":${node}},"block_order":["__proto__"]}},"block_order":["b"]}},"order":["s"]`,
    ),
    "block under a section named __proto__": rootOf(
      kind,
      `"sections":{"__proto__":{"type":"hero","settings":{},"blocks":{"__proto__":${node}},"block_order":["__proto__"]}},"order":["__proto__"]`,
    ),
  };
}

describe("a node hidden under an own `__proto__` key is validated like any other node [AC-ENG-006]", () => {
  for (const kind of TEMPLATE_KINDS) {
    for (const [nodeLabel, node] of Object.entries(BAD_NODES)) {
      for (const [place, text] of Object.entries(hiddenNodeDocs(kind, node))) {
        it(`[AC-ENG-006] ${kind}: ${nodeLabel} at ${place} is rejected and never throws`, () => {
          const input = parse(text);
          for (const context of [undefined, { tenantId: T }]) {
            const res = validateDocument(kind, input, registry, context);
            expect(res.ok).toBe(false);
            expect(errorsOf(res.issues).length).toBeGreaterThan(0);
          }
        });
      }
    }
  }

  it("[AC-ENG-006] [AC-ENG-016] the reported path names the own `__proto__` key exactly", () => {
    const section = validateDocument("index", parse(rootOf("index", `"sections":{"__proto__":null},"order":["__proto__"]`)), registry, { tenantId: T });
    expect(section.ok).toBe(false);
    expect(section.issues.some((i) => i.code === "SCHEMA_ERROR" && i.path === "sections.__proto__")).toBe(true);

    const block = validateDocument(
      "index",
      parse(rootOf("index", `"sections":{"s":{"type":"hero","settings":{},"blocks":{"__proto__":{}},"block_order":["__proto__"]}},"order":["s"]`)),
      registry,
      { tenantId: T },
    );
    expect(block.issues.some((i) => i.code === "SCHEMA_ERROR" && i.path === "sections.s.blocks.__proto__.type")).toBe(true);
  });

  // Changed (Task 13): an own `__proto__` is never a legitimate component id, so a well-formed node under it is
  // now rejected (it used to be accepted). See engine-proto-ids.test.ts for the full matrix.
  it("[AC-ENG-006] a well-formed node under an own `__proto__` id is rejected at its exact path", () => {
    const text = rootOf("index", `"sections":{"__proto__":${GOOD_HERO}},"order":["__proto__"]`);
    const res = validateDocument("index", parse(text), registry, { tenantId: T });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "SCHEMA_ERROR" && i.path === "sections.__proto__" && i.level === "error")).toBe(true);
  });

  it("[AC-ENG-006] the section list stays authoritative: a `__proto__` section missing from order is an ORDER_MISMATCH, not a crash", () => {
    const res = validateDocument("index", parse(rootOf("index", `"sections":{"__proto__":${GOOD_HERO}},"order":[]`)), registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "ORDER_MISMATCH" && i.path === "order")).toBe(true);
  });
});

describe("own `__proto__` keys are rejected where no component id can live [AC-ENG-006]", () => {
  const at = (res: ReturnType<typeof validateDocument>, path: string) =>
    res.issues.some((i) => i.level === "error" && i.code === "SCHEMA_ERROR" && i.path === path);

  const THEME_CASES: Record<string, { body: string; path: string }> = {
    "theme settings root": { body: '"settings":{"__proto__":{"x":1}}', path: "settings.__proto__" },
    "theme colors": { body: '"settings":{"colors":{"__proto__":"#112233","primary":"#112233"}}', path: "settings.colors.__proto__" },
    "theme typography": { body: '"settings":{"typography":{"__proto__":{"a":1}}}', path: "settings.typography.__proto__" },
    "theme layout": { body: '"settings":{"layout":{"__proto__":5}}', path: "settings.layout.__proto__" },
    "theme buttons": { body: '"settings":{"buttons":{"__proto__":null}}', path: "settings.buttons.__proto__" },
    "theme social": { body: '"settings":{"social":{"__proto__":"https://facebook.com/x"}}', path: "settings.social" },
    "theme extra (catchall) key": { body: '"settings":{"favicon":{"__proto__":{"a":1}}}', path: "settings.favicon.__proto__" },
    "theme array item": { body: '"settings":{"list":[{"__proto__":1}]}', path: "settings.list.0.__proto__" },
  };
  for (const [label, { body, path }] of Object.entries(THEME_CASES)) {
    it(`[AC-ENG-006] [AC-ENG-016] ${label}: rejected at ${path}, with and without a tenant`, () => {
      const input = parse(rootOf("theme_settings", body));
      for (const context of [undefined, { tenantId: T }]) {
        const res = validateDocument("theme_settings", input, registry, context);
        expect(res.ok).toBe(false);
        expect(at(res, path)).toBe(true);
      }
    });
  }

  for (const kind of TEMPLATE_KINDS) {
    it(`[AC-ENG-006] ${kind}: an own \`__proto__\` key at the document root is rejected`, () => {
      const base = parse(rootOf(kind, kind === "theme_settings" ? '"settings":{}' : '"sections":{},"order":[]')) as Record<string, unknown>;
      const text = JSON.stringify(base).replace(/^\{/, '{"__proto__":{"x":1},');
      const res = validateDocument(kind, parse(text), registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(at(res, "__proto__")).toBe(true);
    });
  }

  it("[AC-ENG-006] a section's settings, an extra node key and a nested block's settings reject an own `__proto__` key", () => {
    const text = rootOf(
      "index",
      `"sections":{"s":{"type":"ghost","settings":{"__proto__":{"a":1}},"extra":{"__proto__":2},"blocks":{"b":{"type":"ghost","settings":{"deep":{"__proto__":1}},"blocks":{},"block_order":[]}},"block_order":["b"]}},"order":["s"]`,
    );
    const res = validateDocument("index", parse(text), registry, { tenantId: T });
    expect(res.ok).toBe(false);
    expect(at(res, "sections.s.settings.__proto__")).toBe(true);
    expect(at(res, "sections.s.extra.__proto__")).toBe(true);
    expect(at(res, "sections.s.blocks.b.settings.deep.__proto__")).toBe(true);
  });

  it("[AC-ENG-006] a `__proto__` key is not an own key of a document built by assignment, so ordinary documents are unaffected", () => {
    const doc = { schemaVersion: 1, layout: "classic", sections: {}, order: [], note: "__proto__" };
    expect(validateDocument("index", doc, registry).ok).toBe(true);
  });
});
