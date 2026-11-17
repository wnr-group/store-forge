/** Shapes returned by the StoreForge API's Theme Store endpoints. Plain data: safe in server and client code. */
import type { TemplateDocument } from "@/lib/templates/document";

export const THEME_INDUSTRIES = ["fashion", "electronics", "beauty", "home", "grocery", "general"] as const;
export type ThemeIndustry = (typeof THEME_INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<ThemeIndustry, string> = {
  fashion: "Fashion & apparel",
  electronics: "Electronics",
  beauty: "Beauty",
  home: "Home & furniture",
  grocery: "Grocery",
  general: "General",
};

export type ThemeSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  industry: ThemeIndustry;
  version: number;
  previewImage: string | null;
  isCurrent: boolean;
};

export type ThemeKind = "index" | "product" | "collection" | "theme_settings" | "group_header" | "group_footer" | "group_announcement";

export type ThemeDocuments = Partial<Record<ThemeKind, Record<string, unknown>>>;

export type ThemeDetail = ThemeSummary & { documents: ThemeDocuments };

export type ThemePage = { items: ThemeSummary[]; page: number; limit: number; total: number; totalPages: number };

export type CurrentTheme = {
  theme: ThemeSummary | null;
  appliedVersion: number | null;
  appliedAt: string | null;
  updateAvailable: boolean;
};

export type ApplyThemeResult = { theme: ThemeSummary; draftsWritten: number; draftsReplaced: number };

export type PublicationState = "draft" | "published" | "published_with_changes" | "archived";

export type TemplateSummary = {
  id: string;
  kind: ThemeKind;
  name: string;
  status: "active" | "archived";
  isDefault: boolean;
  revision: number;
  publicationState: PublicationState;
  publishedVersion: number | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type TemplateDetail<D = Record<string, unknown>> = TemplateSummary & { document: D };

export type PreviewBundle = {
  template: TemplateDetail<TemplateDocument>;
  theme: Record<string, unknown> | null;
  groups: { header: TemplateDocument | null; footer: TemplateDocument | null; announcement: TemplateDocument | null };
  storeSlug: string;
};

export type TemplateVersion = {
  id: string;
  versionNumber: number;
  source: "publish" | "rollback" | "migration";
  rolledBackFrom: string | null;
  publishedBy: string | null;
  label: string | null;
  publishedAt: string;
  isLive: boolean;
};

export type PublishResult = {
  published: { templateId: string; kind: ThemeKind; versionNumber: number }[];
  unchanged: number;
  storeSlug: string;
  publishedAt: string;
};

/** Real store data the editor preview renders: the same shapes the public storefront gets. */
export type PreviewStoreData = {
  store: {
    name: string;
    slug: string;
    description: string | null;
    logo_path: string | null;
    currency: string;
    products: {
      name: string;
      slug: string;
      short_description: string | null;
      price_minor: number;
      compare_at_price_minor: number | null;
      image_path: string | null;
    }[];
  };
  collections: { id: string; name: string; slug: string; description: string | null; image_path: string | null; product_count: number }[];
  /** Active products of each collection, by collection slug: what "Featured collection" sections show for that collection. */
  collectionProducts?: Record<string, PreviewStoreData["store"]["products"]>;
  /** The first product as a product page shows it (pictures, options, variants), for the editor's product-page preview. */
  productPage?: Record<string, unknown> | null;
};
