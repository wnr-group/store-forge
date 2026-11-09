import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TemplateDocument } from "../../lib/templates/document";
import { duplicateNode, generateId } from "../../lib/templates/engine/tree";
import { utf8ByteLength, validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";

/**
 * The engine runs in the Phase 6 browser editor as well as on the server, so it may not reach for Node-only
 * or server-only APIs (plan Phase 2: "all pure, no server-only"; AC-ENG-001, AC-REN-018 later).
 */
const ROOT = join(__dirname, "..", "..");
const ENGINE_DIRS = ["lib/templates/engine", "lib/templates/registry"];

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Words after which a `/` starts a regular expression rather than dividing. */
const REGEX_KEYWORDS = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "else", "do", "new", "instanceof"]);

/** Whether a `/` after the code so far (`before`) opens a regex literal; otherwise it divides. */
function startsRegex(before: string): boolean {
  const trimmed = before.trimEnd();
  if (trimmed === "") return true;
  const last = trimmed[trimmed.length - 1];
  if ("(,=:[!&|?{};+-*%<>~^".includes(last)) return true;
  const word = /[A-Za-z_$][\w$]*$/.exec(trimmed)?.[0];
  return word !== undefined && REGEX_KEYWORDS.has(word);
}

/**
 * Removes comments but nothing else: a small tokenizer that copies string, template (with its `${}` code)
 * and regex literals verbatim, so a `//` or a quote inside one never hides or invents code. Line comments
 * become their newline, block comments a space. Everything that is not a comment stays, so a forbidden call
 * in a string or template (`import(\`fs\`)`, `from "fs"`) is still seen.
 */
function stripComments(src: string): string {
  let at = 0;
  function code(untilBrace: boolean): string {
    let out = "";
    let depth = 0;
    while (at < src.length) {
      const c = src[at];
      const next = src[at + 1];
      if (c === "/" && next === "/") {
        while (at < src.length && src[at] !== "\n") at++;
      } else if (c === "/" && next === "*") {
        const end = src.indexOf("*/", at + 2);
        at = end === -1 ? src.length : end + 2;
        out += " ";
      } else if (c === '"' || c === "'") {
        const start = at++;
        while (at < src.length && src[at] !== c && src[at] !== "\n") at += src[at] === "\\" ? 2 : 1;
        at++;
        out += src.slice(start, at);
      } else if (c === "`") {
        out += template();
      } else if (c === "/" && startsRegex(out)) {
        const start = at++;
        let inClass = false;
        while (at < src.length && src[at] !== "\n" && (inClass || src[at] !== "/")) {
          if (src[at] === "\\") at++;
          else if (src[at] === "[") inClass = true;
          else if (src[at] === "]") inClass = false;
          at++;
        }
        at++;
        out += src.slice(start, at);
      } else {
        if (untilBrace && c === "{") depth++;
        if (untilBrace && c === "}") {
          if (depth === 0) return out;
          depth--;
        }
        out += c;
        at++;
      }
    }
    return out;
  }
  function template(): string {
    let out = src[at++];
    while (at < src.length && src[at] !== "`") {
      if (src[at] === "\\") {
        out += src.slice(at, at + 2);
        at += 2;
      } else if (src[at] === "$" && src[at + 1] === "{") {
        at += 2;
        out += "${" + code(true) + "}";
        at++;
      } else {
        out += src[at++];
      }
    }
    if (at < src.length) out += src[at++];
    return out;
  }
  return code(false);
}

const FILES = ENGINE_DIRS.flatMap((d) => listSources(join(ROOT, d)));

/** Node builtins, each with an optional subpath such as "fs/promises". */
const BUILTINS = ["fs", "path", "crypto", "os", "child_process"] as const;
const builtinFrom = (name: string) => new RegExp(`from\\s+["']${name}(?:/[\\w-]+)?["']`);

const FORBIDDEN: Array<[string, RegExp]> = [
  ['from "node:', /from\s+["'`]node:/],
  ['from "fs"', builtinFrom("fs")],
  ['from "path"', builtinFrom("path")],
  ['from "crypto"', builtinFrom("crypto")],
  ['from "os"', builtinFrom("os")],
  ['from "child_process"', builtinFrom("child_process")],
  ['from "server-only"', /from\s+["']server-only["']/],
  ['import "server-only"', /\bimport\s+["']server-only["']/],
  ["require(", /\brequire\s*\(/],
  ["Buffer", /\bBuffer\b/],
  ["process.", /\bprocess\s*\??\./],
  ["__dirname", /\b__dirname\b/],
  ['import("node:', /import\(\s*["'`]node:/],
  ['side-effect import "node:', /\bimport\s+["']node:/],
  [
    'import("fs"|"path"|"crypto"|"os"|"child_process")',
    new RegExp(`import\\(\\s*["'\`](?:${BUILTINS.join("|")})(?:/[\\w-]+)?["'\`]`),
  ],
  ["typeof process", /\btypeof\s+process\b/],
  ["globalThis.process", /\bglobalThis\s*(?:\.\s*process\b|\[\s*["'`]process["'`]\s*\])/],
  ["process[", /\bprocess\s*\[/],
  ["import from @/lib/db", /from\s+["']@\/lib\/db/],
  ["import from @/lib/supabase", /from\s+["']@\/lib\/supabase/],
  ["import from next/*", /from\s+["']next(\/|["'])/],
  ["import from react", /from\s+["']react(\/|["'])/],
];

/** Labels of every forbidden pattern found in `source` (comments are ignored). */
function findForbidden(source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN.filter(([, pattern]) => pattern.test(code)).map(([label]) => label);
}

describe("Engine is browser-safe [AC-ENG-001]", () => {
  it("[AC-ENG-001] finds the engine and registry sources to scan", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`[AC-ENG-001] no engine or registry module uses ${label}`, () => {
      const offenders = FILES.filter((file) => pattern.test(stripComments(readFileSync(file, "utf8"))));
      expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
    });
  }

  it("[AC-ENG-001] the support modules under lib/templates stay free of Node-only APIs", () => {
    const support = ["document", "limits", "presets", "registry", "resolve", "types", "form-state"].map((n) =>
      join(ROOT, "lib/templates", `${n}.ts`),
    );
    for (const file of support) {
      expect({ file: file.slice(ROOT.length + 1), hits: findForbidden(readFileSync(file, "utf8")) }).toMatchObject({
        hits: [],
      });
    }
  });
});

describe("The browser-safety scanner flags what it should [AC-ENG-001]", () => {
  const MUTANTS: Array<[string, string]> = [
    ['from "node:', 'import { readFileSync } from "node:fs";'],
    ['from "fs"', "import fs from 'fs';"],
    ['from "path"', 'import { join } from "path";'],
    ['from "crypto"', 'import { randomBytes } from "crypto";'],
    ['from "fs"', 'import { readFile } from "fs/promises";'],
    ['from "os"', 'import os from "os";'],
    ['from "os"', 'import { cpus } from "os";'],
    ['from "child_process"', 'import { exec } from "child_process";'],
    ['from "server-only"', 'import guard from "server-only";'],
    ['import "server-only"', 'import "server-only";'],
    ["require(", 'const fs = require("fs");'],
    ["require(", 'const fs = require ("fs");'],
    ["Buffer", "const n = Buffer.byteLength(x);"],
    ["process.", "const e = process.env.NODE_ENV;"],
    ["process.", "const e = process\n  .env.NODE_ENV;"],
    ["process.", "const e = process?.env.NODE_ENV;"],
    // A `//` inside a literal is not a comment: the code after it on the same line is still scanned.
    ["process.", 'const note = "see // here"; const e = process.env.X;'],
    ["process.", 'const note = "x"; const re = /"/; const e = process.env.X;'],
    ["require(", "const t = `a // b`; const fs = require('fs');"],
    ["require(", "const t = `${1}`; const fs = require('fs'); // trailing"],
    ["__dirname", "const d = __dirname;"],
    ['import("node:', 'const m = await import("node:fs");'],
    ['side-effect import "node:', 'import "node:fs";'],
    ['import("fs"|"path"|"crypto"|"os"|"child_process")', 'const m = await import("fs");'],
    ['import("fs"|"path"|"crypto"|"os"|"child_process")', "const m = await import('child_process');"],
    ['import("fs"|"path"|"crypto"|"os"|"child_process")', 'const m = await import("fs/promises");'],
    ['import("fs"|"path"|"crypto"|"os"|"child_process")', "const m = await import(`fs`);"],
    ['import("fs"|"path"|"crypto"|"os"|"child_process")', 'const m = await import("os");'],
    ['import("node:', "const m = await import(`node:fs`);"],
    ["typeof process", 'const isNode = typeof process !== "undefined";'],
    ["globalThis.process", "const p = globalThis.process;"],
    ["globalThis.process", 'const p = globalThis["process"];'],
    ["globalThis.process", "const p = globalThis['process'];"],
    ["process[", 'const e = process["env"];'],
    ["import from @/lib/db", 'import { db } from "@/lib/db/client";'],
    ["import from @/lib/supabase", 'import { createClient } from "@/lib/supabase/server";'],
    ["import from next/*", 'import { headers } from "next/headers";'],
    ["import from react", 'import { useState } from "react";'],
  ];

  for (const [label, source] of MUTANTS) {
    it(`[AC-ENG-001] flags ${label} in: ${source}`, () => {
      expect(findForbidden(source)).toContain(label);
    });
  }

  it("[AC-ENG-001] every forbidden pattern is exercised by a mutant", () => {
    const covered = new Set(MUTANTS.map(([label]) => label));
    expect(FORBIDDEN.map(([label]) => label).filter((label) => !covered.has(label))).toEqual([]);
  });

  it("[AC-ENG-001] does not flag clean code, comments or look-alike names", () => {
    const clean = [
      'import { z } from "zod";',
      'const url = "https://example.com/process";',
      "// import fs from 'fs'; typeof process; Buffer.from(x)",
      "/* const e = process.env; require('fs'); */",
      "const processed = processItems(items); const subprocess = 1; const bufferSize = 4;",
      'const label = "typeof processor";',
      "const process_ = {}; const a = processor[0];",
      "export const importMap = { fs: 1 };",
      // Comments hide their content, whatever quotes or slashes the comment or the code before it holds.
      "// don't use process.env here",
      "/* it's fine: require('fs') and \"quoted\" */ const a = 1;",
      'const u = "http://x.test"; // process.env in a trailing comment',
      "const half = total / 2; // require('fs')",
      "const re = /[\"']/g; const ok = re.test(x); // process.env",
      "const t = `value ${/* process.env */ 1}`;",
      "const m = a / b; /* import fs from 'fs' */ const n = c / d;",
    ];
    for (const source of clean) expect(findForbidden(source)).toEqual([]);
  });
});

describe("UTF-8 byte counting without Buffer [AC-ENG-001]", () => {
  const lone = (code: number) => String.fromCharCode(code);
  const table: Array<[string, string]> = [
    ["empty", ""],
    ["ascii", "hello world"],
    ["latin1", "café naïve"],
    ["cjk", "日本語テスト"],
    ["emoji (surrogate pair)", "launch 🚀 now"],
    ["many pairs", "😀".repeat(50)],
    ["lone high surrogate", lone(0xd800)],
    ["lone low surrogate", `a${lone(0xdc00)}b`],
    ["high then non-low", `${lone(0xd83d)}x`],
    ["reversed pair", `${lone(0xde80)}${lone(0xd83d)}`],
    ["json-like", JSON.stringify({ a: [1, 2, { b: "é🚀" }] })],
  ];

  for (const [name, value] of table) {
    it(`[AC-ENG-001] matches Buffer.byteLength for ${name}`, () => {
      expect(utf8ByteLength(value)).toBe(Buffer.byteLength(value, "utf8"));
    });
  }
});

describe("Id generation without node:crypto [AC-ENG-001]", () => {
  it("[AC-ENG-001] keeps the prefix_hex format and defaults the prefix to c", () => {
    expect(generateId("sec")).toMatch(/^sec_[0-9a-f]+$/);
    expect(generateId("blk")).toMatch(/^blk_[0-9a-f]+$/);
    expect(generateId()).toMatch(/^c_[0-9a-f]+$/);
  });

  it("[AC-ENG-001] produces 10,000 unique ids that use only characters safe for ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(generateId("blk"));
    expect(ids.size).toBe(10_000);
    for (const id of ids) expect(id).toMatch(/^blk_[A-Za-z0-9_-]+$/);
  });
});

describe("No hidden Node dependency at call time [AC-ENG-001]", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const doc: TemplateDocument = {
    schemaVersion: 1,
    layout: "classic",
    sections: {
      hero: { type: "hero", settings: { heading: "Hi 🚀" }, blocks: {}, block_order: [] },
    },
    order: ["hero"],
  };

  it("[AC-ENG-001] validate and duplicateNode work with Buffer and process undefined", () => {
    const registry = getRegistry();
    // The assertion library itself needs process, so only the engine calls run while the globals are hidden.
    vi.stubGlobal("Buffer", undefined);
    vi.stubGlobal("process", undefined);
    let hidden: { buffer: string; process: string };
    let result: ReturnType<typeof validateDocument>;
    let copy: ReturnType<typeof duplicateNode>;
    let copyResult: ReturnType<typeof validateDocument>;
    try {
      hidden = { buffer: typeof Buffer, process: typeof process };
      result = validateDocument("index", doc, registry);
      copy = duplicateNode(doc, "hero");
      copyResult = validateDocument("index", copy.doc, registry);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(hidden).toEqual({ buffer: "undefined", process: "undefined" });
    expect(result.ok).toBe(true);
    expect(copy.doc.order).toHaveLength(2);
    expect(copyResult.ok).toBe(true);
  });
});
