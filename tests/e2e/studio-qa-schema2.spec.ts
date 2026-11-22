import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
const H = { Origin: "http://localhost:3100" };
test("API behaviour for schema 2 + display on a Studio-enabled store (evidence only)", async ({ browser }) => {
  const out: Record<string, unknown> = {};
  const orgId = await asUser(browser, "owner", async (p) => ((await (await p.context().request.get(`${API}/organizations`)).json()).data as { id: string; name: string }[]).find((o) => /urban nest/i.test(o.name))!.id);
  await asUser(browser, "platform", (p) => p.context().request.put(`${API}/platform/organizations/${orgId}/studio-rollout`, { headers: H, data: { enabled: true, reason: "QA schema-2 evidence" } }));
  try {
    await asUser(browser, "owner", async (p) => {
      const r = p.context().request;
      const lst = (await (await r.get(`${API}/store/templates`)).json()).data as { id: string; kind: string; isDefault: boolean }[];
      const home = lst.find((t) => t.kind === "index" && t.isDefault)!;
      const d = (await (await r.get(`${API}/store/templates/${home.id}`)).json()).data;
      const base = structuredClone(d.document);
      const key = base.order[0];
      const v2 = structuredClone(base); v2.schemaVersion = 2; v2.sections[key].display = { v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] };
      const a = await r.put(`${API}/store/templates/${home.id}/draft`, { headers: H, data: { document: v2, expectedRevision: d.revision } });
      out.v2_with_display = { status: a.status(), body: (await a.text()).slice(0, 400) };
      const v1 = structuredClone(base); v1.sections[key].display = v2.sections[key].display;
      const b = await r.put(`${API}/store/templates/${home.id}/draft`, { headers: H, data: { document: v1, expectedRevision: d.revision } });
      out.v1_with_display = { status: b.status(), body: (await b.text()).slice(0, 400) };
      const c = await r.put(`${API}/store/templates/${home.id}/draft`, { headers: H, data: { document: base, expectedRevision: d.revision } });
      out.v1_plain_control = { status: c.status() };
      expect(c.ok()).toBe(true);
    });
  } finally {
    await asUser(browser, "platform", (p) => p.context().request.put(`${API}/platform/organizations/${orgId}/studio-rollout`, { headers: H, data: { enabled: false, reason: "QA cleanup" } }));
    mkdirSync("artifacts/qa/studio/test-results", { recursive: true });
    writeFileSync("artifacts/qa/studio/test-results/R1-schema2-api-behaviour.json", JSON.stringify(out, null, 2));
  }
});
