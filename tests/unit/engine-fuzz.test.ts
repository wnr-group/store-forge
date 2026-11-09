import { describe, expect, it } from "vitest";
import { TEMPLATE_KINDS, type TemplateKind } from "../../lib/templates/document";
import { validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";

// Final-review fix 1: validateDocument must never throw. A seeded, deterministic generator writes malformed
// documents as JSON TEXT (so `__proto__` becomes a real own key after JSON.parse, which no object literal can do),
// and every one of them must come back as ok:true with a deep-equal document, or ok:false with an error issue.
const registry = getRegistry();

/** mulberry32: a tiny seeded PRNG, so a failure always reproduces. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "path" is last on purpose: the id lists only use KEYS.slice(0, 9). It makes image-shaped objects (a string
// `path`) appear at every position the generator reaches, for the independent oracle below.
const KEYS = ["a", "b", "c", "__proto__", "constructor", "toString", "hasOwnProperty", "0", "1", "42", "", " ", "sections", "blocks", "type", "path"];
const PATHS = ["tenant-a/store/a.png", "tenant-b/store/a.png", "tenant-a/store/", "a.png", "/tenant-a/store/a.png", "tenant-a/store/../x", ""];
const TYPES = ["hero", "product-grid", "ghost", "card", "text", "", "__proto__", "constructor"];

function generate(seed: number): { kind: TemplateKind; text: string } {
  const random = rng(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const chance = (p: number) => random() < p;
  const q = (s: string) => JSON.stringify(s);

  /** A junk JSON value: nulls, numbers, strings, arrays, small objects (own `__proto__` keys included). */
  function junk(depth: number): string {
    const r = random();
    if (r < 0.15 || depth > 3) return pick(["null", "0", "7", "-1.5", "1e21", "true", "false", '""', '"x"', '"__proto__"', q(pick(PATHS))]);
    if (r < 0.25) return `{"path":${q(pick(PATHS))}${chance(0.3) ? ',"alt":"x"' : ""}}`; // an image-shaped value
    if (r < 0.45) {
      const n = Math.floor(random() * 4);
      return `[${Array.from({ length: n }, () => junk(depth + 1)).join(",")}]`;
    }
    const keys = Array.from({ length: Math.floor(random() * 4) }, () => pick(KEYS));
    return `{${[...new Set(keys)].map((k) => `${q(k)}:${junk(depth + 1)}`).join(",")}}`;
  }

  function idList(keys: string[]): string {
    const r = random();
    if (r < 0.65) return `[${keys.map(q).join(",")}]`;
    if (r < 0.75) return `[${[...keys, ...keys].map(q).join(",")}]`; // duplicates
    if (r < 0.82) return "[]";
    if (r < 0.88) return `[${Array.from({ length: 3000 }, (_, i) => q(`id${i}`)).join(",")}]`; // a giant list
    if (r < 0.94) return `[${[...keys.map(q), "1", "null"].join(",")}]`;
    return junk(0);
  }

  function node(depth: number): string {
    if (chance(0.08)) return junk(0);
    const children: string[] = [];
    const wantsChildren = depth < 5 && chance(depth === 0 ? 0.7 : 0.45);
    const count = wantsChildren ? 1 + Math.floor(random() * 3) : 0;
    for (let i = 0; i < count; i++) children.push(pick(KEYS.slice(0, 9)));
    const unique = [...new Set(children)];
    const blocks = chance(0.92) ? `{${unique.map((k) => `${q(k)}:${node(depth + 1)}`).join(",")}}` : junk(0);
    const fields: string[] = [];
    const add = (name: string, value: string, p = 0.93) => chance(p) && fields.push(`${q(name)}:${value}`);
    add("type", chance(0.85) ? q(pick(TYPES)) : junk(0));
    const ownImage = '{"image":{"path":"tenant-a/store/a.png","alt":"x"},"gallery":[{"path":"tenant-a/store/b.png"}]}';
    add("settings", chance(0.85) ? (chance(0.2) ? ownImage : chance(0.8) ? "{}" : `{${q(pick(KEYS))}:${junk(0)}}`) : junk(0));
    add("blocks", blocks);
    add("block_order", idList(unique));
    add("disabled", chance(0.9) ? pick(["true", "false"]) : junk(0), 0.3);
    if (chance(0.05)) fields.push(`${q(pick(KEYS))}:${junk(0)}`);
    return `{${fields.join(",")}}`;
  }

  /** A long chain of single-child blocks, deeper than the limit and sometimes thousands deep. */
  function chain(levels: number): string {
    let text = node(5);
    for (let i = 0; i < levels; i++) {
      text = `{"type":"card","settings":{},"blocks":{"c":${text}},"block_order":["c"]}`;
    }
    return text;
  }

  const kind = pick(TEMPLATE_KINDS);
  const sectionKeys = Array.from(new Set(Array.from({ length: Math.floor(random() * 4) }, () => pick(KEYS.slice(0, 9)))));
  const sections = chance(0.07)
    ? `{"deep":${chain(chance(0.5) ? 6 : 4000)}}`
    : `{${sectionKeys.map((k) => `${q(k)}:${node(0)}`).join(",")}}`;
  const rootFields: string[] = [];
  const add = (name: string, value: string, p = 0.94) => chance(p) && rootFields.push(`${q(name)}:${value}`);
  add("schemaVersion", chance(0.9) ? "1" : junk(0));
  add("layout", chance(0.8) ? q(pick(["classic", "spotlight", "default", ""])) : junk(0), kind === "theme_settings" ? 0.2 : 0.85);
  add("sections", chance(0.93) ? sections : junk(0), kind === "theme_settings" ? 0.3 : 0.95);
  add("order", chance(0.8) ? idList(sectionKeys.length > 0 && chance(0.8) ? sectionKeys : ["deep"]) : junk(0), kind === "theme_settings" ? 0.3 : 0.95);
  if (kind === "theme_settings") add("settings", chance(0.5) ? junk(0) : `{"colors":${junk(1)},"typography":${junk(1)},"social":${junk(1)}}`, 0.7);
  if (chance(0.1)) rootFields.push(`${q(pick(KEYS))}:${junk(0)}`);
  return { kind, text: `{${rootFields.join(",")}}` };
}

/**
 * An oracle for every ok:true result, written from the stated rules and independent of the engine (only the
 * public validateDocument is imported): every visited node is well-formed, an own `__proto__` key appears
 * nowhere (not even as a section or block id), and every object with a string `path` (an image) lies under
 * `<tenant>/store/`, or there is none at all when no tenant is given. Returns the problems found.
 */
function oracleProblems(doc: unknown, tenant: string | undefined): string[] {
  const problems: string[] = [];
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  const images: { path: string; where: string }[] = [];

  /** Notes an image-shaped object and an own `__proto__` key on `obj` (an object that is not an id map). */
  function inspectObject(obj: Record<string, unknown>, where: string) {
    if (Object.hasOwn(obj, "__proto__")) problems.push(`own __proto__ key at ${where}`);
    if (Object.hasOwn(obj, "path") && typeof obj.path === "string") images.push({ path: obj.path, where });
  }

  /** Any value that is not a section or block map or a node: no `__proto__` key and no foreign image anywhere inside. */
  function generic(value: unknown, where: string) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => generic(item, `${where}.${index}`));
    } else if (isObj(value)) {
      inspectObject(value, where);
      for (const key of Object.keys(value)) generic(value[key], `${where}.${key}`);
    }
  }

  /** A component node (`depth` = block levels under its section, 0 for a section): the shape rules, then its keys, `blocks` being an id map. */
  function node(value: unknown, where: string, depth: number) {
    if (!isObj(value)) return void problems.push(`${where} is not an object`);
    if (depth > 3) problems.push(`${where} is nested deeper than 3 block levels`);
    if (typeof value.type !== "string") problems.push(`${where}.type is not a string`);
    if (!isObj(value.settings)) problems.push(`${where}.settings is not a plain object`);
    if (!isObj(value.blocks)) problems.push(`${where}.blocks is not a plain object`);
    else idMap(value.blocks, value.block_order, `${where}.blocks`, depth + 1);
    inspectObject(value, where);
    for (const key of Object.keys(value)) {
      if (key !== "blocks") generic(value[key], `${where}.${key}`);
    }
  }

  /** A section or block map plus its order list: the order names every key exactly once, nothing else. */
  function idMap(map: Record<string, unknown>, order: unknown, where: string, depth: number) {
    const keys = Object.keys(map);
    if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) {
      problems.push(`${where} order is not a list of strings`);
    } else {
      if (new Set(order).size !== order.length) problems.push(`${where} order has duplicates`);
      if (order.length !== keys.length || !order.every((id) => keys.includes(id))) problems.push(`${where} order does not match the keys`);
    }
    // An own `__proto__` is never a legitimate component id: no accepted document may contain one.
    if (Object.hasOwn(map, "__proto__")) problems.push(`own __proto__ id at ${where}`);
    for (const key of keys) node(map[key], `${where}.${key}`, depth);
  }

  if (!isObj(doc)) return ["the document is not an object"];
  inspectObject(doc, "");
  for (const key of Object.keys(doc)) {
    // A theme document has no section list at all, so a missing `order` means "no sections" there.
    if (key === "sections" && isObj(doc.sections)) idMap(doc.sections, doc.order === undefined ? [] : doc.order, "sections", 0);
    else generic(doc[key], key);
  }

  for (const { path, where } of images) {
    if (tenant === undefined) problems.push(`image-shaped object at ${where || "(root)"} although no tenant was given`);
    else if (!path.startsWith(`${tenant}/store/`)) problems.push(`image at ${where || "(root)"} has path ${JSON.stringify(path)} outside ${tenant}/store/`);
  }
  return problems;
}

/**
 * Documents that are valid by construction (unique ids, exact orders, at most 3 block levels, the tenant's own
 * images in settings), where half of the seeds then get ONE planted flaw as a text edit (a foreign image, an own
 * `__proto__` key, a `path` directly on a node or the root). Random junk almost never survives validation, so
 * without this the oracle would see too few accepted documents.
 */
function generateNearValid(seed: number): { kind: TemplateKind; text: string; flaw: string } {
  const random = rng(seed ^ 0x9e3779b9);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const chance = (p: number) => random() < p;
  let counter = 0;
  const image = () => ({ path: `tenant-a/store/${pick(["a.png", "b/c.png"])}`, ...(chance(0.3) ? { alt: "x" } : {}) });
  const settings = (): Record<string, unknown> =>
    pick([{}, { image: image() }, { gallery: [image(), image()] }, { nested: { deep: { image: image() } } }, { text: "hi", n: 3, on: true }]);
  const node = (depth: number, type: string): Record<string, unknown> => {
    const count = type === "ghost" && depth < 3 && chance(0.6) ? 1 + Math.floor(random() * 3) : 0;
    const ids = Array.from({ length: count }, () => `n${counter++}`);
    return {
      type,
      settings: type === "ghost" ? settings() : {},
      blocks: Object.fromEntries(ids.map((id) => [id, node(depth + 1, "ghost")])),
      block_order: ids,
      ...(chance(0.2) ? { disabled: chance(0.5) } : {}),
    };
  };

  const kind = pick(TEMPLATE_KINDS);
  let doc: Record<string, unknown>;
  if (kind === "theme_settings") {
    doc = { schemaVersion: 1, settings: { colors: { primary: "#112233" }, ...(chance(0.7) ? { favicon: image() } : {}) } };
  } else {
    const ids = Array.from({ length: Math.floor(random() * 4) }, () => `n${counter++}`);
    doc = { schemaVersion: 1, layout: "classic", sections: Object.fromEntries(ids.map((id) => [id, node(0, pick(["ghost", "ghost", "hero"]))])), order: ids };
  }
  let text = JSON.stringify(doc);
  const flaws: [string, (t: string) => string][] = [
    ["foreign image", (t) => t.replace("tenant-a/store/", "tenant-b/store/")],
    [
      "proto key in settings",
      (t) => t.replace(/"settings":\{(\}?)/, (_m, close: string) => (close ? '"settings":{"__proto__":{"x":1}}' : '"settings":{"__proto__":{"x":1},')),
    ],
    ["path on a node", (t) => t.replace('"type":', '"path":"tenant-b/store/z.png","type":')],
    ["own path on a node", (t) => t.replace('"type":', '"path":"tenant-a/store/z.png","type":')],
    ["path on the root", (t) => t.replace('{"schemaVersion":1', '{"path":"tenant-b/store/z.png","schemaVersion":1')],
  ];
  let flaw = "none";
  if (chance(0.5)) {
    const [name, apply] = pick(flaws);
    flaw = name;
    text = apply(text);
  }
  return { kind, text, flaw };
}

type FuzzCase = { seed: number; label: string; kind: TemplateKind; text: string };

/** Runs one case in both contexts; returns how often it was accepted, rejected and accepted with an own image. */
function checkCase({ seed, label, kind, text }: FuzzCase): { accepted: number; rejected: number; ownImage: number } {
  const tally = { accepted: 0, rejected: 0, ownImage: 0 };
  for (const context of [undefined, { tenantId: "tenant-a" }]) {
    const input = JSON.parse(text) as unknown;
    let res: ReturnType<typeof validateDocument> | undefined;
    try {
      res = validateDocument(kind, input, registry, context);
    } catch (error) {
      throw new Error(`${label} seed ${seed} (${kind}) threw: ${String(error)}\n${text.slice(0, 400)}`);
    }
    // The internal-error catch is a safety net, not an answer: reaching it means a bug.
    expect({ label, seed, internal: res.issues.some((i) => i.code === "INTERNAL_ERROR") }).toEqual({ label, seed, internal: false });
    if (res.ok) {
      tally.accepted++;
      if (context && text.includes('"path":"tenant-a/store/')) tally.ownImage++;
      expect(res.document).toEqual(JSON.parse(text));
      const problems = oracleProblems(res.document, context?.tenantId);
      expect({ label, seed, kind, tenant: context?.tenantId, problems }).toEqual({ label, seed, kind, tenant: context?.tenantId, problems: [] });
    } else {
      tally.rejected++;
      expect({ label, seed, errors: res.issues.filter((i) => i.level === "error").length > 0 }).toEqual({ label, seed, errors: true });
    }
  }
  return tally;
}

describe("validateDocument never throws on malformed JSON.parse output [AC-ENG-006] [AC-ENG-016]", () => {
  const RUNS = 600;

  it(`[AC-ENG-006] [AC-ENG-016] ${RUNS} seeded random malformed documents: ok:true with a deep-equal document that passes the oracle, or ok:false with an error`, () => {
    let accepted = 0;
    let rejected = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const result = checkCase({ seed, label: "random", ...generate(seed) });
      accepted += result.accepted;
      rejected += result.rejected;
    }
    // The generator must exercise both outcomes, or the test proves nothing.
    expect(accepted).toBeGreaterThan(20);
    expect(rejected).toBeGreaterThan(200);
  });

  it("[AC-ENG-006] [AC-ENG-016] 800 seeded near-valid documents (half with one planted flaw): the oracle holds for every accepted one", () => {
    const flaws = new Map<string, { accepted: number; rejected: number }>();
    let ownImage = 0;
    for (let seed = 1; seed <= 800; seed++) {
      const { flaw, ...generated } = generateNearValid(seed);
      const result = checkCase({ seed, label: `near-valid (${flaw})`, ...generated });
      const entry = flaws.get(flaw) ?? { accepted: 0, rejected: 0 };
      entry.accepted += result.accepted;
      entry.rejected += result.rejected;
      flaws.set(flaw, entry);
      ownImage += result.ownImage;
    }
    // Unflawed documents are accepted (in both contexts, unless they hold an image and no tenant is given) and
    // the oracle sees plenty of accepted images; every planted flaw is caught in at least the tenant context.
    expect(flaws.get("none")?.accepted).toBeGreaterThan(300);
    expect(ownImage).toBeGreaterThan(100);
    for (const name of ["foreign image", "proto key in settings", "path on a node", "path on the root"]) {
      expect(flaws.get(name)?.rejected, name).toBeGreaterThan(5);
    }
    // A flaw that is the tenant's own path must still be accepted when a tenant is given.
    expect(flaws.get("own path on a node")?.accepted).toBeGreaterThan(5);
  });

  it("[AC-ENG-006] the generator is deterministic (same seed, same document)", () => {
    expect(generate(17)).toEqual(generate(17));
    expect(generate(17).text).not.toEqual(generate(18).text);
  });

  it("[AC-ENG-006] the generator reaches own `__proto__` keys, null nodes, giant lists and deep chains", () => {
    const texts = Array.from({ length: RUNS }, (_, i) => generate(i + 1).text);
    expect(texts.filter((t) => t.includes('"__proto__":')).length).toBeGreaterThan(30);
    expect(texts.filter((t) => t.includes(":null")).length).toBeGreaterThan(30);
    expect(texts.filter((t) => t.includes('"id2999"')).length).toBeGreaterThan(5);
    expect(texts.filter((t) => t.includes('"deep"')).length).toBeGreaterThan(5);
  });
});

describe("the fuzz oracle itself, and the image-shaped components it found [AC-ENG-016]", () => {
  const T = "tenant-a";
  const node = (extra: Record<string, unknown> = {}) => ({ type: "ghost", settings: {}, blocks: {}, block_order: [], ...extra });
  const page = (sections: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    layout: "classic",
    sections,
    order: Object.keys(sections),
    ...extra,
  });

  it("[AC-ENG-016] the oracle reports each kind of planted flaw (it is not vacuous)", () => {
    const parse = (text: string) => JSON.parse(text) as unknown;
    const clean = page({ s: node({ settings: { image: { path: `${T}/store/a.png` } } }) });
    expect(oracleProblems(clean, T)).toEqual([]);
    expect(oracleProblems(clean, undefined).join()).toMatch(/no tenant was given/);
    expect(oracleProblems(page({ s: node({ settings: { image: { path: "other/store/a.png" } } }) }), T).join()).toMatch(/outside tenant-a\/store\//);
    expect(oracleProblems(page({ s: node({ path: "other/store/a.png" }) }), T).join()).toMatch(/outside/);
    expect(oracleProblems(page({}, { path: "other/store/a.png" }), T).join()).toMatch(/outside/);
    expect(oracleProblems(page({ s: node({ settings: [{ path: "x" }] }) }), T).join()).toMatch(/is not a plain object/);
    expect(oracleProblems(page({ s: node({ blocks: [] }) }), T).join()).toMatch(/blocks is not a plain object/);
    expect(oracleProblems(page({ s: node({ type: 5 }) }), T).join()).toMatch(/type is not a string/);
    expect(oracleProblems(page({ s: node({ blocks: { b: node() }, block_order: [] }) }), T).join()).toMatch(/does not match the keys/);
    expect(oracleProblems(page({ s: node({ blocks: { b: node() }, block_order: ["b", "b"] }) }), T).join()).toMatch(/duplicates/);
    expect(oracleProblems({ ...page({}), order: ["x"] }, T).join()).toMatch(/does not match the keys/);
    expect(oracleProblems(page({ s: node({ settings: parse('{"__proto__":{}}') }) }), T).join()).toMatch(/own __proto__/);
    // An own `__proto__` as a section or block id is reported too: it is never a legitimate id.
    const protoNode = '{"type":"t","settings":{},"blocks":{},"block_order":[]}';
    expect(oracleProblems(parse(`{"sections":{"__proto__":${protoNode}},"order":["__proto__"]}`), T).join()).toMatch(/own __proto__ id at sections/);
    expect(
      oracleProblems(parse(`{"sections":{"s":{"type":"t","settings":{},"blocks":{"__proto__":${protoNode}},"block_order":["__proto__"]}},"order":["s"]}`), T).join(),
    ).toMatch(/own __proto__ id at sections\.s\.blocks/);
    const tooDeep = node({ blocks: { a: node({ blocks: { b: node({ blocks: { c: node({ blocks: { d: node() }, block_order: ["d"] }) }, block_order: ["c"] }) }, block_order: ["b"] }) }, block_order: ["a"] });
    expect(oracleProblems(page({ s: tooDeep }), T).join()).toMatch(/nested deeper than 3/);
  });

  it("[AC-ENG-016] a section, a block or the root that itself carries a string `path` is vetted like any image-shaped value", () => {
    const registry = getRegistry();
    const own = `${T}/store/a.png`;
    const foreign = "other/store/a.png";
    const withBlock = (extra: Record<string, unknown>) => page({ s: node({ blocks: { b: node(extra) }, block_order: ["b"] }) });
    const cases: [string, (path: string) => unknown, string][] = [
      ["a section", (path) => page({ s: node({ path }) }), "sections.s"],
      ["a block", (path) => withBlock({ path }), "sections.s.blocks.b"],
      ["the document root", (path) => page({}, { path }), ""],
    ];
    for (const [label, build, where] of cases) {
      const bad = validateDocument("index", build(foreign), registry, { tenantId: T });
      expect({ label, ok: bad.ok, codes: bad.issues.filter((i) => i.level === "error").map((i) => `${i.code}@${i.path}`) }).toEqual({
        label,
        ok: false,
        codes: [`CROSS_TENANT_PATH@${where}`],
      });
      expect(validateDocument("index", build(own), registry, { tenantId: T }).ok, `${label} with the tenant's own path`).toBe(true);
      const noTenant = validateDocument("index", build(own), registry);
      expect({ label, ok: noTenant.ok, codes: noTenant.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ label, ok: false, codes: ["TENANT_REQUIRED"] });
    }
  });
});
