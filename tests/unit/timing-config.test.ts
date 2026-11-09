import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TIMING_TEST_FILES } from "../timing-files";

const root = path.resolve(import.meta.dirname, "../..");

// Files that use performance.now with a fixed budget but are intentionally NOT
// serialised: each budget is coarse (100-500 ms for work that takes a few ms)
// so parallel load cannot realistically trip it.
const COARSE_BUDGET_ALLOW_LIST: Record<string, string> = {
  "tests/unit/engine-richtext.test.ts": "single 100 ms budget on a small input that parses in about 1 ms",
  "tests/unit/engine-audit-bindings.test.ts": "best-of-N against 100 ms for a few-ms operation",
  "tests/unit/engine-value-limits.test.ts": "500 ms budget on pathological-input guards that finish in a few ms",
  "tests/integration/storefront-roundtrips.test.ts": "coarse budget on PGlite storefront page loader [AC-SF-014] [AC-SF-020]",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

async function loadConfig(file: string) {
  const mod = await import(/* @vite-ignore */ path.join(root, file));
  return mod.default as { test: Record<string, unknown> };
}

describe("Timing test isolation [AC-ENG-011] [AC-ENG-020]", () => {
  it("lists two existing, repo-relative timing files [AC-ENG-020]", () => {
    expect(TIMING_TEST_FILES.length).toBe(2);
    for (const file of TIMING_TEST_FILES) {
      expect(file).not.toContain("\\");
      expect(existsSync(path.join(root, file))).toBe(true);
    }
  });

  it("the default config excludes exactly the timing files [AC-ENG-011]", async () => {
    const { test } = await loadConfig("vitest.config.mts");
    const exclude = test.exclude as string[];
    for (const file of TIMING_TEST_FILES) expect(exclude).toContain(file);
    const timingEntries = exclude.filter((entry) => entry.startsWith("tests/"));
    expect([...timingEntries].sort()).toEqual([...TIMING_TEST_FILES].sort());
  });

  it("the timing config includes exactly the timing files, serially [AC-ENG-011] [AC-ENG-020]", async () => {
    const { test } = await loadConfig("vitest.timing.config.mts");
    expect([...(test.include as string[])].sort()).toEqual([...TIMING_TEST_FILES].sort());
    expect(test.fileParallelism).toBe(false);
    expect(test.maxWorkers).toBe(1);
    expect(test.environment).toBe("node");
  });

  it("npm test runs both configs and dedicated scripts exist [AC-ENG-020]", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.test).toBe("vitest run && vitest run --config vitest.timing.config.mts");
    expect(pkg.scripts["test:unit"]).toBe("vitest run");
    expect(pkg.scripts["test:timing"]).toBe("vitest run --config vitest.timing.config.mts");
  });

  it("no other test file asserts a fixed wall-clock budget unless listed or allow-listed [AC-ENG-011] [AC-ENG-020]", () => {
    const hits = walk(path.join(root, "tests"))
      .filter((file) => file.endsWith(".test.ts"))
      .filter((file) => !file.endsWith("timing-config.test.ts"))
      .filter((file) => readFileSync(file, "utf8").includes("performance.now"))
      .map((file) => path.relative(root, file).split(path.sep).join("/"));
    const known = new Set<string>([...TIMING_TEST_FILES, ...Object.keys(COARSE_BUDGET_ALLOW_LIST)]);
    expect(hits.filter((file) => !known.has(file))).toEqual([]);
    for (const file of Object.keys(COARSE_BUDGET_ALLOW_LIST)) {
      expect(hits).toContain(file); // stale allow-list entries fail loudly
    }
  });
});
