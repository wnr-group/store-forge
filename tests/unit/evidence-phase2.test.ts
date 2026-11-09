import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type BenchmarkCase, writeBenchmarkEvidence } from "../../scripts/qa/bench-evidence";
import { type BenchmarkRef, buildPhase2EvidenceIndex, collectTaggedTests, matrixRequirements, type TaggedTest } from "../../scripts/qa/phase2-evidence-index";
import { writePhase2RunResult } from "../../scripts/qa/run-phase2-baseline";
import type { LogManifestEntry } from "../e2e/support/evidence";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sf-evidence-p2-"));
}

const ACCEPTED = '{"phase":"01","runId":"RUN-20261106134102-e3bc"}';

describe("run-phase2-baseline never writes accepted-run.json", () => {
  const result = {
    runId: "RUN-20261107000000-abcd",
    commit: "deadbeef",
    dirty: true,
    timestamp: "2026-11-07T00:00:00.000Z",
    commands: [
      { name: "tsc", command: "node node_modules/typescript/bin/tsc --noEmit", exitCode: 0 },
      { name: "vitest", command: "node node_modules/vitest/vitest.mjs run", exitCode: 1 },
    ],
  };

  it("leaves an existing accepted-run.json byte-identical", () => {
    const base = tmp();
    fs.writeFileSync(path.join(base, "accepted-run.json"), ACCEPTED);
    const before = fs.readFileSync(path.join(base, "accepted-run.json"));
    writePhase2RunResult(base, result);
    expect(fs.readFileSync(path.join(base, "accepted-run.json")).equals(before)).toBe(true);
  });

  it("does not create accepted-run.json when there is none", () => {
    const base = tmp();
    writePhase2RunResult(base, result);
    expect(fs.existsSync(path.join(base, "accepted-run.json"))).toBe(false);
  });

  it("writes phase-02-engine/<RUN-ID>/run-result.json with per-command status and accepted:false", () => {
    const base = tmp();
    const file = writePhase2RunResult(base, result);
    expect(file).toBe(path.join(base, "phase-02-engine", result.runId, "run-result.json"));
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(parsed).toMatchObject({
      phase: "02",
      runId: result.runId,
      commit: "deadbeef",
      dirty: true,
      timestamp: result.timestamp,
      accepted: false,
      reason: "dirty tree / uncommitted; closeout run requires a clean tree at a commit",
    });
    expect(parsed.commands).toEqual([
      { name: "tsc", command: result.commands[0].command, exitCode: 0, status: "PASSED" },
      { name: "vitest", command: result.commands[1].command, exitCode: 1, status: "FAILED" },
    ]);
  });

  it("refuses to overwrite an existing run-result.json", () => {
    const base = tmp();
    writePhase2RunResult(base, result);
    expect(() => writePhase2RunResult(base, result)).toThrow();
  });

  it("the script source contains no write to accepted-run.json", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "scripts", "qa", "run-phase2-baseline.ts"), "utf8");
    expect(src).not.toMatch(/writeFileSync\([^;]*accepted-run/);
  });
});

describe("benchmark evidence writer", () => {
  const sample: BenchmarkCase = {
    name: "validates max-size document",
    acTags: ["AC-ENG-020", "AC-PERF-008"],
    iterations: 4,
    warmup: 5,
    documentBytes: 1234,
    components: 400,
    sections: 25,
    budgetMs: 50,
    samples: [4, 1, 3, 2],
  };

  it("no QA_EVIDENCE_DIR, no file written", () => {
    const watch = tmp();
    const defaultPath = path.join(process.cwd(), "artifacts", "template-engine-qa", "phase-02-engine", "validation-benchmark.json");
    const before = fs.existsSync(defaultPath) ? fs.statSync(defaultPath).mtimeMs : null;
    expect(writeBenchmarkEvidence(sample, {})).toBeNull();
    expect(writeBenchmarkEvidence(sample, { QA_EVIDENCE_DIR: "" })).toBeNull();
    expect(fs.readdirSync(watch)).toEqual([]);
    expect(fs.existsSync(defaultPath) ? fs.statSync(defaultPath).mtimeMs : null).toBe(before);
  });

  it("the benchmark test file has no hard-coded artifacts path and never writes without the helper", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "tests", "unit", "engine-benchmark.test.ts"), "utf8");
    expect(src).not.toMatch(/template-engine-qa/);
    expect(src).not.toMatch(/writeFileSync/);
    expect(src).toMatch(/writeBenchmarkEvidence/);
  });

  it("writes the required fields and the raw samples into QA_EVIDENCE_DIR", () => {
    const dir = path.join(tmp(), "nested", "run");
    const file = writeBenchmarkEvidence(sample, { QA_EVIDENCE_DIR: dir, QA_RUN_MODE: "isolated" });
    expect(file).not.toBeNull();
    expect(path.dirname(file as string)).toBe(dir);
    const parsed = JSON.parse(fs.readFileSync(file as string, "utf8"));
    expect(parsed).toMatchObject({
      case: sample.name,
      acTags: sample.acTags,
      runMode: "isolated",
      cpuCount: os.cpus().length,
      nodeVersion: process.version,
      platform: process.platform,
      iterations: 4,
      warmup: 5,
      documentBytes: 1234,
      components: 400,
      sections: 25,
      budgetMs: 50,
      status: "PASSED",
      samples: [4, 1, 3, 2],
    });
    // Sorted samples [1,2,3,4]: p50 = index 2, p95 = index 3 (same index rule as the tests), max = 4.
    expect(parsed).toMatchObject({ p50Ms: 3, p95Ms: 4, maxMs: 4 });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("runMode is parallel-suite unless QA_RUN_MODE is exactly isolated", () => {
    const dir = tmp();
    const read = (env: Record<string, string>) => JSON.parse(fs.readFileSync(writeBenchmarkEvidence(sample, { QA_EVIDENCE_DIR: dir, ...env }) as string, "utf8")).runMode;
    expect(read({})).toBe("parallel-suite");
    expect(read({ QA_RUN_MODE: "other" })).toBe("parallel-suite");
    expect(read({ QA_RUN_MODE: "isolated" })).toBe("isolated");
  });

  it("marks FAILED when p95 exceeds the budget and never overwrites (numeric suffix)", () => {
    const dir = tmp();
    const slow: BenchmarkCase = { ...sample, samples: [10, 60, 70, 80] };
    const first = writeBenchmarkEvidence(slow, { QA_EVIDENCE_DIR: dir }) as string;
    const second = writeBenchmarkEvidence(sample, { QA_EVIDENCE_DIR: dir }) as string;
    const third = writeBenchmarkEvidence(sample, { QA_EVIDENCE_DIR: dir }) as string;
    expect(new Set([first, second, third]).size).toBe(3);
    expect(JSON.parse(fs.readFileSync(first, "utf8")).status).toBe("FAILED");
    expect(JSON.parse(fs.readFileSync(second, "utf8")).status).toBe("PASSED");
    expect(path.basename(second)).toMatch(/-2\.json$/);
    expect(path.basename(third)).toMatch(/-3\.json$/);
  });
});

describe("timing test sample counts", () => {
  it("the richtext linear-time cases take the best of 7 samples and keep their thresholds", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "tests", "unit", "engine-richtext-corpus.test.ts"), "utf8");
    expect(src).toMatch(/bestTime\(small, 7\)/);
    expect(src).toMatch(/bestTime\(big, 7\)/);
    expect(src).not.toMatch(/bestTime\([^)]*, 3\)/);
    expect(src).toMatch(/toBeLessThan\(50\)/);
    expect(src).toMatch(/toBeLessThan\(100\)/);
    expect(src).toMatch(/15 \* Math\.max\(t20, 2\)/);
  });
});

const MATRIX = [
  "| AC | Cls | Requirement | Dec | Location | Test | Evidence | Shot | Impl | Phase | Final |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  "| AC-ENG-001 | A | One registry | D5 | `descriptors.ts` | unit; `[AC-ENG-001]` | LOG | n/a | NOT STARTED | P2 | NOT STARTED |",
  "| AC-ENG-002 | A | Closed enum | D5 | `descriptors.ts` | unit; `[AC-ENG-002]` | LOG | n/a | NOT STARTED | P2 | NOT STARTED |",
  "| AC-ENG-003 | A | Compiler | D5 | `compile.ts` | unit; `[AC-ENG-003]` | LOG | n/a | NOT STARTED | P2 | NOT STARTED |",
  "| AC-ENG-018 | A | Migrated docs | D18 | `t.test.ts` | PGlite; `[AC-ENG-018]` | LOG+SQL | n/a | NOT STARTED | P2 | NOT STARTED |",
  "| AC-ENG-020 | A | Max doc fast | D19 | benchmark | bench; `[AC-ENG-020]` | LOG | n/a | NOT STARTED | P2 | NOT STARTED |",
  "| AC-PERF-008 | A | Perf max doc | D19 | measurement | measurement; `[AC-PERF-008]` | LOG | n/a | NOT STARTED | P2 | NOT STARTED |",
  "| AC-DB-001 | A | Not ours | D1 | x | y | LOG | n/a | IMPLEMENTED | P1 | PASSED WITH EVIDENCE |",
].join("\n");

const root = path.join(os.tmpdir(), "repo");
const vitestJson = {
  testResults: [
    {
      name: path.join(root, "tests", "unit", "engine-a.test.ts"),
      assertionResults: [
        { fullName: "A [AC-ENG-001] works", title: "[AC-ENG-001] works", status: "passed" },
        { fullName: "A [AC-ENG-001] also works", title: "also", status: "passed" },
        { fullName: "A [AC-ENG-002] [AC-ENG-003] shared", title: "shared", status: "passed" },
        { fullName: "A untagged", title: "untagged", status: "passed" },
        { fullName: "A [AC-ENG-002] fails", title: "fails", status: "failed" },
      ],
    },
    {
      name: path.join(root, "tests", "unit", "engine-benchmark.test.ts"),
      assertionResults: [
        { fullName: "Bench [AC-ENG-020] [AC-PERF-008] fast", title: "fast", status: "passed" },
      ],
    },
  ],
};

function logRow(over: Partial<LogManifestEntry>): LogManifestEntry {
  return {
    evidenceId: "LOG-RUN-X-001",
    ac: "AC-ENG-001",
    runId: "RUN-X",
    timestamp: "2026-11-07T00:00:00.000Z",
    path: "logs/RUN-X/a.log",
    sha256: "abc",
    provenance: "current",
    type: "vitest",
    commit: "deadbeef",
    dirty: true,
    ...over,
  };
}

describe("phase 2 AC evidence index", () => {
  it("collects tagged tests from the JSON reporter output, relative to the repo root", () => {
    const tests = collectTaggedTests(vitestJson, root);
    const byAc = (ac: string) => tests.filter((t) => t.ac === ac);
    expect(byAc("AC-ENG-001")).toHaveLength(2);
    expect(byAc("AC-ENG-002").map((t) => t.status).sort()).toEqual(["failed", "passed"]);
    expect(byAc("AC-ENG-003")).toHaveLength(1); // a test with two tags counts for each AC
    expect(byAc("AC-ENG-001")[0].file).toBe("tests/unit/engine-a.test.ts");
    expect(tests.some((t) => t.title.includes("untagged"))).toBe(false);
  });

  it("accepts the short [PERF-008] tag as AC-PERF-008", () => {
    const tests = collectTaggedTests({ testResults: [{ name: path.join(root, "tests", "unit", "b.test.ts"), assertionResults: [{ fullName: "Bench [AC-ENG-020] [PERF-008] x", title: "x", status: "passed" }] }] }, root);
    expect(tests.map((t) => t.ac).sort()).toEqual(["AC-ENG-020", "AC-PERF-008"]);
  });

  function build(tests: TaggedTest[]) {
    return buildPhase2EvidenceIndex({
      runId: "RUN-X",
      matrixContent: MATRIX,
      tests,
      logRows: [
        logRow({ ac: "AC-ENG-001" }),
        logRow({ evidenceId: "LOG-RUN-X-002", ac: "AC-ENG-018", path: "sql/RUN-X/AC-ENG-018-presets.json", type: "sql" }),
        logRow({ evidenceId: "LOG-RUN-OLD-009", runId: "RUN-OLD", ac: "AC-ENG-001", path: "logs/RUN-OLD/x.log" }),
        { ...logRow({ evidenceId: "LOG-RUN-X-003", ac: "AC-ENG-003", path: "logs/RUN-X/engine.log" }), supports: ["AC-ENG-002"] },
      ],
      benchmarks: [{ file: "phase-02-engine/RUN-X/validation-benchmark.json", acTags: ["AC-ENG-020", "AC-PERF-008"], runMode: "isolated", p50Ms: 1.5, p95Ms: 2.5, name: "max" }],
    });
  }

  it("emits one row per ENG-001..020 and PERF-008 with computed statuses", () => {
    const { rows, markdown } = build(collectTaggedTests(vitestJson, root));
    expect(rows).toHaveLength(21);
    const get = (ac: string) => rows.find((r) => r.ac === ac)!;
    expect(get("AC-ENG-001")).toMatchObject({ passed: 2, failed: 0, finalStatus: "IN PROGRESS" });
    expect(get("AC-ENG-002")).toMatchObject({ passed: 1, failed: 1, finalStatus: "FAILED" });
    expect(get("AC-ENG-002").failingTitles).toEqual(["A [AC-ENG-002] fails"]);
    expect(get("AC-ENG-004")).toMatchObject({ passed: 0, failed: 0, finalStatus: "NOT STARTED" });
    expect(get("AC-ENG-020")).toMatchObject({ passed: 1, finalStatus: "IN PROGRESS" });
    expect(get("AC-PERF-008")).toMatchObject({ passed: 1, finalStatus: "IN PROGRESS" });
    expect(markdown).not.toContain("PASSED WITH EVIDENCE");
    expect(markdown).toContain("not applicable (backend AC, Appendix C 4.3)");
    expect(markdown).toContain("dirty tree: evidence is not clean-tree current-run evidence (Appendix C 2.2)");
  });

  it("uses this run's evidence rows only, the requirement text from the matrix, and the benchmark and SQL files", () => {
    const { rows, markdown } = build(collectTaggedTests(vitestJson, root));
    const e1 = rows.find((r) => r.ac === "AC-ENG-001")!;
    expect(e1.requirement).toBe("One registry");
    expect(e1.evidence).toEqual(["LOG-RUN-X-001 logs/RUN-X/a.log"]);
    expect(markdown).not.toContain("LOG-RUN-OLD-009");
    // A log registered for one AC with a `supports` list is evidence for each listed AC too.
    expect(rows.find((r) => r.ac === "AC-ENG-002")!.evidence).toEqual(["LOG-RUN-X-003 logs/RUN-X/engine.log"]);
    expect(rows.find((r) => r.ac === "AC-ENG-003")!.evidence).toEqual(["LOG-RUN-X-003 logs/RUN-X/engine.log"]);
    expect(rows.find((r) => r.ac === "AC-ENG-018")!.evidence).toEqual(["LOG-RUN-X-002 sql/RUN-X/AC-ENG-018-presets.json"]);
    expect(markdown).toContain("phase-02-engine/RUN-X/validation-benchmark.json (isolated, p50 1.5 ms, p95 2.5 ms)");
    expect(markdown).not.toContain("AC-DB-001");
  });
});

describe("phase 2 AC evidence index: open-gap tests and benchmark detail", () => {
  const gapJson = {
    testResults: [
      {
        name: path.join(root, "tests", "unit", "engine-a.test.ts"),
        assertionResults: [{ fullName: "A [AC-ENG-001] works", title: "works", status: "passed" }],
      },
      {
        name: path.join(root, "tests", "unit", "engine-theme-gap.test.ts"),
        assertionResults: [
          { fullName: "Gap [AC-ENG-001] open gap: flat ids", title: "flat", status: "passed" },
          { fullName: "Gap [AC-ENG-001] open gap: bounds", title: "bounds", status: "passed" },
        ],
      },
    ],
  };
  const gapInput = (benchmarks: BenchmarkRef[]) => ({
    runId: "RUN-X",
    matrixContent: MATRIX,
    tests: collectTaggedTests(gapJson, root),
    logRows: [],
    benchmarks,
  });

  it("lists open-gap tests separately and never counts them as passing evidence", () => {
    const { rows, markdown } = buildPhase2EvidenceIndex(gapInput([]));
    const r = rows.find((x) => x.ac === "AC-ENG-001")!;
    expect(r.passed).toBe(1);
    expect(r.openGap.map((t) => t.title)).toEqual(["Gap [AC-ENG-001] open gap: flat ids", "Gap [AC-ENG-001] open gap: bounds"]);
    expect(markdown).toContain("open-gap tests (documented gap, not pass evidence)");
    expect(markdown).toContain(
      "theme-settings descriptors vs validated shape divergence is an OPEN GAP (see engine-theme-gap tests); AC-ENG-001 is proven for sections/blocks only",
    );
    // Other ACs get no open-gap note.
    expect(rows.find((x) => x.ac === "AC-ENG-002")!.openGap).toEqual([]);
  });

  it("an AC whose only tagged tests are open-gap tests is NOT STARTED", () => {
    const only = { testResults: [gapJson.testResults[1]] };
    const { rows } = buildPhase2EvidenceIndex({ ...gapInput([]), tests: collectTaggedTests(only, root) });
    expect(rows.find((x) => x.ac === "AC-ENG-001")).toMatchObject({ passed: 0, finalStatus: "NOT STARTED" });
  });

  it("shows every benchmark case with run mode, p50, p95, max, budget and raw samples", () => {
    const b = (name: string, mode: string): BenchmarkRef => ({
      file: `phase-02-engine/RUN-X/${name}.json`,
      name,
      acTags: ["AC-ENG-020", "AC-PERF-008"],
      runMode: mode,
      p50Ms: 1,
      p95Ms: 2,
      maxMs: 3,
      budgetMs: 50,
      samples: [1, 2, 3],
    });
    const { markdown } = buildPhase2EvidenceIndex(gapInput([b("near-limit 256 KB 400-component document", "isolated"), b("max-size document", "parallel-suite")]));
    expect(markdown).toContain("## Benchmark cases");
    expect(markdown).toContain("near-limit 256 KB 400-component document");
    expect(markdown).toContain("(isolated, p50 1 ms, p95 2 ms, max 3 ms, budget 50 ms)");
    expect(markdown).toContain("samples: [1, 2, 3]");
  });
});

describe("matrix requirement lookup with appended run-time sections", () => {
  it("takes the requirement from the first (live matrix) row, not from a later run-time result table", () => {
    const content = [
      "| AC-ENG-001 | A | One registry | D5 | `x.ts` | unit | LOG | n/a | IN PROGRESS | P2 | IN PROGRESS |",
      "",
      "## Phase 2 run-time results, RUN-ID RUN-OLD",
      "| AC-ENG-001 | One registry | tests/unit/engine-a.test.ts | 2 | 0 | 0 | none | none | none | n/a | IN PROGRESS | dirty |",
    ].join("\n");
    expect(matrixRequirements(content).get("AC-ENG-001")).toBe("One registry");
  });
});

describe("benchmark evidence writer: near-limit case name", () => {
  it("writes the fourth case under its own slug", () => {
    const dir = path.join(tmp(), "nl");
    const file = writeBenchmarkEvidence(
      { name: "near-limit 256 KB 400-component document", acTags: ["AC-ENG-020"], iterations: 2, warmup: 5, documentBytes: 250000, components: 400, sections: 25, budgetMs: 50, samples: [1, 2] },
      { QA_EVIDENCE_DIR: dir },
    );
    expect(path.basename(file as string)).toBe("validation-benchmark-near-limit-256-kb-400-component-document.json");
  });
});
