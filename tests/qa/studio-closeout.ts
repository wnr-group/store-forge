// node scripts/qa/studio-closeout.ts
// Reads artifacts/studio/ac-evidence.json (one entry per original acceptance criterion, curated from real runs), validates every
// claimed evidence file (exists, non-empty; screenshots: real PNG, >=300x200, >=5 KB, under the AC's own folder, content unique
// across ACs) and refuses PASSED_WITH_EVIDENCE otherwise. Writes the AC evidence report and the screenshot index.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "FAILED" | "PASSED_WITH_EVIDENCE";
type Entry = {
  id: string; criterion: string; source: string; implementation: string[]; tests: string[]; testTypes: string[]; result: string;
  status: Status; note?: string; screenshots?: { file: string; url: string; action: string; visible: string }[];
  needs: ("screenshot" | "api" | "db" | "log")[]; api?: string[]; db?: string[]; log?: string[]; defects?: string[];
};
const SHOTS = "artifacts/qa/screenshots";
const SHA = process.env.STUDIO_SHA ?? "";

function validatePng(path: string): string | null {
  const b = readFileSync(path);
  if (b.length < 5 * 1024) return "smaller than 5 KB";
  if (!b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "not a PNG";
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  return w < 300 || h < 200 ? `too small ${w}x${h}` : null;
}
const nonEmpty = (p: string) => existsSync(p) && statSync(p).isFile() && statSync(p).size > 0;

export function validate(entries: Entry[], root: string): { problems: string[]; downgraded: Entry[] } {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const downgraded = entries.map((e) => {
    const bad: string[] = [];
    if (e.status === "PASSED_WITH_EVIDENCE") {
      if (!/^[0-9a-f]{40}$/.test(SHA)) bad.push("STUDIO_SHA (40-hex) not set");
      if (!e.tests.length || !e.testTypes.length) bad.push("no executed test id/type");
      for (const n of e.needs) {
        const have = n === "screenshot" ? e.screenshots : n === "api" ? e.api : n === "db" ? e.db : e.log;
        if (!have?.length) bad.push(`needs ${n} evidence`);
      }
      for (const f of [...(e.api ?? []), ...(e.db ?? []), ...(e.log ?? [])]) if (!nonEmpty(join(root, "artifacts/studio", f))) bad.push(`missing/empty evidence ${f}`);
      for (const s of e.screenshots ?? []) {
        const p = resolve(root, SHOTS, s.file);
        if (!p.startsWith(resolve(root, SHOTS, e.id))) { bad.push(`screenshot not under ${e.id}/: ${s.file}`); continue; }
        if (!existsSync(p)) { bad.push(`screenshot missing: ${s.file}`); continue; }
        const v = validatePng(p);
        if (v) bad.push(`screenshot rejected (${v}): ${s.file}`);
        const h = createHash("sha256").update(readFileSync(p)).digest("hex");
        if (seen.has(h)) bad.push(`screenshot content reused from ${seen.get(h)}: ${s.file}`);
        seen.set(h, e.id);
      }
    }
    if (bad.length) { problems.push(`${e.id}: ${bad.join("; ")}`); return { ...e, status: "FAILED" as Status, note: `evidence rejected: ${bad.join("; ")}` }; }
    return e;
  });
  return { problems, downgraded };
}

if (process.argv[1]?.endsWith("studio-closeout.ts")) {
  const root = process.cwd();
  const entries = JSON.parse(readFileSync("artifacts/studio/ac-evidence.json", "utf8")) as Entry[];
  const { problems, downgraded } = validate(entries, root);
  const count = (s: Status) => downgraded.filter((e) => e.status === s).length;
  const lines = ["# Studio acceptance criteria evidence report", "", `Tested commit (frontend): \`${SHA}\``, "", "| Status | Count |", "|---|---:|", ...(["PASSED_WITH_EVIDENCE", "FAILED", "BLOCKED", "IN_PROGRESS", "NOT_STARTED"] as Status[]).map((s) => `| ${s} | ${count(s)} |`), `| Total original criteria | ${downgraded.length} |`, ""];
  if (problems.length) lines.push("## Evidence rejected by the validator", ...problems.map((p) => `- ${p}`), "");
  for (const e of downgraded) {
    lines.push(`## ${e.id} — ${e.status}`, "", `**Criterion:** ${e.criterion}`, "", `- Source: ${e.source}`, `- Implementation: ${e.implementation.join(", ") || "-"}`, `- Tests (${e.testTypes.join(", ")}): ${e.tests.join("; ") || "-"}`, `- Result: ${e.result}`, e.note ? `- Note: ${e.note}` : "", `- Screenshots: ${(e.screenshots ?? []).map((s) => `${SHOTS}/${s.file}`).join(", ") || "-"}`, `- API evidence: ${(e.api ?? []).map((f) => `artifacts/studio/${f}`).join(", ") || "-"}`, `- DB evidence: ${(e.db ?? []).map((f) => `artifacts/studio/${f}`).join(", ") || "-"}`, `- Log/other evidence: ${(e.log ?? []).map((f) => `artifacts/studio/${f}`).join(", ") || "-"}`, `- Defects: ${(e.defects ?? []).join(", ") || "-"}`, "");
  }
  writeFileSync("artifacts/qa/STUDIO_AC_EVIDENCE_REPORT.md", lines.filter((l) => l !== undefined).join("\n"));
  const idx = ["# Studio screenshot index", "", "| AC ID | Screenshot path | Page/URL | User action | Expected visible result | Test result |", "|---|---|---|---|---|---|"];
  for (const e of downgraded) for (const s of e.screenshots ?? []) idx.push(`| ${e.id} | ${SHOTS}/${s.file} | ${s.url} | ${s.action} | ${s.visible} | ${e.status} |`);
  const files = existsSync(SHOTS) ? readdirSync(SHOTS).filter((d) => /^AC-/.test(d)).flatMap((d) => readdirSync(join(SHOTS, d)).map((f) => `${d}/${f}`)) : [];
  idx.push("", `Files actually present under ${SHOTS}/AC-*: ${files.length}`, ...files.map((f) => `- ${f}`));
  writeFileSync("artifacts/qa/STUDIO_SCREENSHOT_INDEX.md", idx.join("\n"));
  console.log(JSON.stringify({ passed: count("PASSED_WITH_EVIDENCE"), failed: count("FAILED"), blocked: count("BLOCKED"), inProgress: count("IN_PROGRESS"), notStarted: count("NOT_STARTED"), rejected: problems.length }));
}
