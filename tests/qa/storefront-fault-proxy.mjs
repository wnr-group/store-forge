// node scripts/qa/storefront-fault-proxy.mjs  (env: FAULT_TARGET=http://localhost:4000, FAULT_REAL_SLUG=urban-nest-demo, FAULT_PORT=4100)
// Sits between a SECOND Next server (API_BASE_URL=http://127.0.0.1:4100/api/v1) and the real API.
// Only /public/storefronts/fault-* is touched: the slug is rewritten to the real demo slug (so the Next fetch cache is cold per
// run) and the response is healthy, a 500, or a malformed layout, depending on the mode. Everything else passes through.
import { createServer } from "node:http";

const TARGET = process.env.FAULT_TARGET ?? "http://localhost:4000";
const REAL = process.env.FAULT_REAL_SLUG ?? "urban-nest-demo";
const PORT = Number(process.env.FAULT_PORT ?? 4100);
const MALFORMED = { "bad-order": { sections: {}, order: 5 }, "null-section": { sections: { a: null }, order: ["a"] } };
let mode = "pass";
let storefrontRequests = 0;
const SF = /^\/api\/v1\/public\/storefronts\/(fault-[^/?]+)(\/[^?]*)?(\?.*)?$/;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/__fault/mode") { mode = url.searchParams.get("mode") ?? "pass"; res.end(`mode=${mode}`); return; }
  if (url.pathname === "/__fault/stats") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ storefrontRequests })); return; }

  const m = SF.exec(req.url ?? "");
  let path = req.url ?? "/";
  if (m) {
    storefrontRequests++;
    path = `/api/v1/public/storefronts/${REAL}${m[2] ?? ""}${m[3] ?? ""}`;
    if (mode === "http500") { res.statusCode = 500; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ success: false, message: "SECRET internal detail: db password=hunter2" })); return; }
  }
  const upstream = await fetch(`${TARGET}${path}`, { method: req.method, headers: { accept: "application/json", "content-type": req.headers["content-type"] ?? "application/json" } });
  let body = Buffer.from(await upstream.arrayBuffer());
  if (m && (m[2] ?? "").startsWith("/layout") && MALFORMED[mode] !== undefined) {
    const json = JSON.parse(body.toString("utf8"));
    if (json?.data?.template) json.data.template.document = MALFORMED[mode];
    body = Buffer.from(JSON.stringify(json));
  }
  res.statusCode = upstream.status;
  res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
  res.end(body);
}).listen(PORT, "127.0.0.1", () => console.log(`fault proxy on ${PORT} -> ${TARGET}`));
