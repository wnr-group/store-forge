import { describe, expect, it } from "vitest";
import { deploymentFromResult, deploymentFromTemplates, timeAgo } from "@/lib/themes/editor/deployment";
import type { PublishResult, TemplateSummary } from "@/lib/themes/types";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const template = (over: Partial<TemplateSummary>): TemplateSummary => ({ id: "t", kind: "index", name: "Index", status: "active", isDefault: true, revision: 1, publicationState: "published", publishedVersion: 1, publishedAt: "2026-11-20T10:00:00Z", updatedAt: "2026-11-20T10:00:00Z", ...over });

describe("deployments", () => {
  it("describes the publish that just finished, pages a shopper sees first", () => {
    const result: PublishResult = {
      published: [
        { templateId: "h", kind: "group_header", versionNumber: 3 },
        { templateId: "i", kind: "index", versionNumber: 12 },
        { templateId: "s", kind: "theme_settings", versionNumber: 5 },
      ],
      unchanged: 2,
      storeSlug: "urban-nest-demo",
      publishedAt: "2026-11-20T11:59:30Z",
      productPresentations: { published: 4 },
    };
    const d = deploymentFromResult(result);
    expect(d.source).toBe("publish");
    expect(d.pages.map((p) => `${p.name} v${p.version}`)).toEqual(["Home page v12", "Header v3", "Theme settings v5"]);
    expect(d.products).toBe(4);
    expect(d.publishedAt).toBe("2026-11-20T11:59:30Z");
  });

  it("reads what is live from the pages: published pages only, newest publish time", () => {
    const d = deploymentFromTemplates([
      template({ id: "i", kind: "index", publishedVersion: 12, publishedAt: "2026-11-20T10:00:00Z" }),
      template({ id: "p", kind: "product", publishedVersion: 4, publishedAt: "2026-11-19T09:00:00Z" }),
      template({ id: "c", kind: "collection", publishedVersion: null, publishedAt: null, publicationState: "draft" }),
      template({ id: "x", kind: "group_footer", status: "archived", publishedVersion: 2 }),
    ]);
    expect(d?.source).toBe("live");
    expect(d?.pages.map((p) => `${p.name} v${p.version}`)).toEqual(["Home page v12", "Product page v4"]);
    expect(d?.publishedAt).toBe("2026-11-20T10:00:00Z");
  });

  it("is null when nothing was ever published", () => {
    expect(deploymentFromTemplates([template({ publishedVersion: null, publishedAt: null, publicationState: "draft" })])).toBeNull();
    expect(deploymentFromTemplates([])).toBeNull();
  });

  it("says how long ago in plain words", () => {
    const ago = (seconds: number) => timeAgo(new Date(NOW - seconds * 1000).toISOString(), NOW);
    expect(ago(5)).toBe("just now");
    expect(ago(60)).toBe("1 minute ago");
    expect(ago(5 * 60)).toBe("5 minutes ago");
    expect(ago(3 * 3600)).toBe("3 hours ago");
    expect(ago(2 * 86400)).toBe("2 days ago");
    expect(timeAgo("not a date", NOW)).toBe("");
  });
});

describe("changes that are not published", () => {
  it("lists pages changed since publish and pages never published, like the editor badge", async () => {
    const { pendingFromTemplates } = await import("@/lib/themes/editor/deployment");
    const rows = pendingFromTemplates([
      template({ id: "i", kind: "index", publicationState: "published" }),
      template({ id: "p", kind: "product", publicationState: "published_with_changes", publishedVersion: 4 }),
      template({ id: "f", kind: "group_footer", publicationState: "draft", publishedVersion: null, publishedAt: null }),
      template({ id: "x", kind: "collection", publicationState: "draft", publishedVersion: null, status: "archived" }),
    ]);
    expect(rows.map((r) => `${r.name}:${r.neverPublished ? "new" : "changed"}`)).toEqual(["Product page:changed", "Footer:new"]);
  });
});

describe("which theme is deployed", () => {
  it("names the theme a look is named after, and none for the shared standard look", async () => {
    const { lookThemeName } = await import("@/lib/templates/looks");
    expect(lookThemeName("market")).toBe("Marketplace");
    expect(lookThemeName("sport")).toBe("Stride");
    expect(lookThemeName("boutique")).toBe("Maison");
    expect(lookThemeName("standard")).toBeNull();
  });
});
