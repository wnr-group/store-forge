import type { PublishResult, TemplateSummary, ThemeKind } from "@/lib/themes/types";

/** What is live on the store, as the Deployment dialog shows it: when it went live, which pages and at which version. */
export type Deployment = {
  publishedAt: string;
  pages: { id: string; kind: ThemeKind; name: string; version: number }[];
  /** Products whose own settings went live with it (only known right after a publish). */
  products: number;
  /** `publish`: the publish that just finished. `live`: what the store has now, read from the pages' published versions. */
  source: "publish" | "live";
};

const KIND_NAME: Record<ThemeKind, string> = {
  index: "Home page",
  product: "Product page",
  collection: "Collection page",
  theme_settings: "Theme settings",
  group_header: "Header",
  group_footer: "Footer",
  group_announcement: "Announcement bar",
};

/** Shared parts last, so the pages a shopper sees come first. */
const ORDER: ThemeKind[] = ["index", "product", "collection", "group_announcement", "group_header", "group_footer", "theme_settings"];
const byKind = (a: { kind: ThemeKind }, b: { kind: ThemeKind }) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind);

/** The publish that just finished. */
export function deploymentFromResult(result: PublishResult): Deployment {
  return {
    publishedAt: result.publishedAt,
    pages: result.published.map((p) => ({ id: p.templateId, kind: p.kind, name: KIND_NAME[p.kind] ?? p.kind, version: p.versionNumber })).sort(byKind),
    products: result.productPresentations?.published ?? 0,
    source: "publish",
  };
}

/**
 * What the store has live now, from the list of pages: every active page with a published version, and the time of the latest
 * publish. Null when nothing was ever published.
 */
export function deploymentFromTemplates(templates: TemplateSummary[]): Deployment | null {
  const live = templates.filter((t) => t.status === "active" && t.publishedVersion !== null && t.publishedAt);
  if (live.length === 0) return null;
  const latest = live.reduce((a, t) => (new Date(t.publishedAt!) > new Date(a) ? t.publishedAt! : a), live[0].publishedAt!);
  return {
    publishedAt: latest,
    pages: live.map((t) => ({ id: t.id, kind: t.kind, name: KIND_NAME[t.kind] ?? t.name, version: t.publishedVersion! })).sort(byKind),
    products: 0,
    source: "live",
  };
}

/** "just now", "3 minutes ago", "2 hours ago", "5 days ago", then the date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(then));
}

/** The name a shopper-facing page or shared part goes by ("Home page", "Header" ...). */
export const kindName = (kind: ThemeKind): string => KIND_NAME[kind] ?? kind;

/** A page or shared part whose latest draft is not live: changed since it was published, or never published. */
export type PendingPage = { id: string; kind: ThemeKind; name: string; neverPublished: boolean };

/** Everything with changes that are not published. The same rule as the editor's "Changes not published" badge. */
export function pendingFromTemplates(templates: TemplateSummary[]): PendingPage[] {
  return templates
    .filter((t) => t.status === "active" && t.publicationState !== "published")
    .map((t) => ({ id: t.id, kind: t.kind, name: KIND_NAME[t.kind] ?? t.name, neverPublished: t.publishedVersion === null }))
    .sort(byKind);
}
