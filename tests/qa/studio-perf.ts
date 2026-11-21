// node scripts/qa/studio-perf.ts --label baseline|after   (env: BENCH_API, BENCH_TOKEN, BENCH_ORG, BENCH_CONFIRM_NON_SHARED=yes)
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";

const label = process.argv[process.argv.indexOf("--label") + 1];
if (!label || label.startsWith("--")) throw new Error("pass --label baseline|after");
if (process.env.BENCH_CONFIRM_NON_SHARED !== "yes") throw new Error("Set BENCH_CONFIRM_NON_SHARED=yes: this script saves drafts, publishes and rolls back.");
const { BENCH_API, BENCH_TOKEN, BENCH_ORG, E2E_BASE_URL = "http://localhost:3100", E2E_STORE_SLUG = "urban-nest-demo", E2E_PRODUCT_SLUG } = process.env;
if (!BENCH_API || !BENCH_TOKEN || !BENCH_ORG) throw new Error("BENCH_API, BENCH_TOKEN and BENCH_ORG are required.");
const RUNS = 7;

async function call<T>(method: string, path: string, body?: unknown, anonymous = false): Promise<{ ms: number; data: T }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!anonymous) Object.assign(headers, { authorization: `Bearer ${BENCH_TOKEN}`, "x-organization-id": BENCH_ORG! });
  const t = performance.now();
  const res = await fetch(`${BENCH_API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  const ms = Math.round(performance.now() - t);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return { ms, data: ((await res.json().catch(() => null)) as { data?: T } | null)?.data as T };
}
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const sh = (c: string) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch { return "unavailable"; } };

type Doc = { sections: Record<string, { disabled?: boolean }>; order: string[] };
const list = (await call<{ id: string; kind: string; isDefault: boolean }[]>("GET", "/store/templates")).data;
const tpl = list.find((t) => t.kind === "index" && t.isDefault) ?? list.find((t) => t.kind === "index");
if (!tpl) throw new Error("no index template in this store");
const original = (await call<{ revision: number; document: Doc }>("GET", `/store/templates/${tpl.id}`)).data;

const draft: number[] = [], publish: number[] = [], rollback: number[] = [];
for (let i = 0; i < RUNS; i++) {
  const cur = (await call<{ revision: number; document: Doc }>("GET", `/store/templates/${tpl.id}`)).data;
  const doc = structuredClone(cur.document);
  const first = doc.order[0];
  if (doc.sections[first].disabled) delete doc.sections[first].disabled; else doc.sections[first].disabled = true;
  const saved = await call<{ revision: number }>("PUT", `/store/templates/${tpl.id}/draft`, { document: doc, expectedRevision: cur.revision });
  draft.push(saved.ms);
  publish.push((await call("POST", `/store/templates/${tpl.id}/publish`, { expectedRevision: saved.data.revision })).ms);
  const versions = (await call<{ id: string; isLive: boolean }[]>("GET", `/store/templates/${tpl.id}/versions`)).data;
  const previous = versions.find((v) => !v.isLive);
  if (previous) rollback.push((await call("POST", `/store/templates/${tpl.id}/rollback`, { versionId: previous.id })).ms);
}
const end = (await call<{ revision: number }>("GET", `/store/templates/${tpl.id}`)).data;
const restored = await call<{ revision: number }>("PUT", `/store/templates/${tpl.id}/draft`, { document: original.document, expectedRevision: end.revision });
await call("POST", `/store/templates/${tpl.id}/publish`, { expectedRevision: restored.data.revision });

const home: number[] = [];
for (let i = 0; i < RUNS; i++) { const t = performance.now(); const r = await fetch(`${E2E_BASE_URL}/s/${E2E_STORE_SLUG}`); await r.text(); home.push(Math.round(performance.now() - t)); }
const presentationRead: number[] = [];
if (E2E_PRODUCT_SLUG) for (let i = 0; i < RUNS; i++) presentationRead.push((await call("GET", `/public/storefronts/${E2E_STORE_SLUG}/products/${E2E_PRODUCT_SLUG}`, undefined, true)).ms);
const publicLayout: number[] = [];
for (let i = 0; i < RUNS; i++) publicLayout.push((await call("GET", `/public/storefronts/${E2E_STORE_SLUG}/layout?kind=index`, undefined, true)).ms);

const result = {
  label, takenAt: new Date().toISOString(), runs: RUNS,
  environment: { node: process.version, os: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length, memGb: Math.round(os.totalmem() / 1e9), api: BENCH_API, frontend: E2E_BASE_URL },
  commits: { fe: sh("git -C C:/Users/Eshwar/WNR/store-forge-integ rev-parse HEAD"), apiTree: sh("git -C C:/Users/Eshwar/WNR/store-forge-api-integ rev-parse HEAD") },
  dataset: { store: E2E_STORE_SLUG, template: tpl.id, indexSections: original.document.order.length, productSlug: E2E_PRODUCT_SLUG ?? null },
  results: {
    draftSaveMs: { median: median(draft), all: draft }, publishMs: { median: median(publish), all: publish }, rollbackMs: { median: median(rollback), all: rollback },
    storefrontHomeFetchMs: { median: median(home), all: home },
    publicProductReadMs: { median: median(presentationRead), all: presentationRead },
    publicLayoutReadMs: { median: median(publicLayout), all: publicLayout },
  },
};
mkdirSync("artifacts/studio/perf", { recursive: true });
writeFileSync(`artifacts/studio/perf/${label}.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.results, null, 2));
