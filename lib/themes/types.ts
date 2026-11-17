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
  /** Only on a whole-theme publish, and only when the API supports product presentations: how many products went live. */
  productPresentations?: { published: number };
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

/** Per-product presentation, as the StoreForge API returns it (`/store/product-presentations`). Dates are ISO strings. */
export type PresentationState = "default" | "draft" | "published" | "published_with_changes";

export type PresentationSummary = {
  productId: string;
  revision: number;
  publicationState: PresentationState;
  publishedAt: string | null;
  updatedAt: string;
};

export type PresentationDetail = {
  productId: string;
  /** Sent back as `expectedRevision` when saving. 0 means the product has no customization yet. */
  revision: number;
  publicationState: PresentationState;
  /** The draft. */
  document: Record<string, unknown>;
  /** What shoppers see now; null when never published. */
  publishedDocument: Record<string, unknown> | null;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type PresentationPublishResult = PresentationDetail & {
  /** False when the draft already matched what shoppers see. */
  published: boolean;
};

/** One row of the editor's product picker: an active product of the store, from the admin product list. */
export type PickerProduct = { id: string; name: string; slug: string; imagePath: string | null };
export type PickerPage = { items: PickerProduct[]; page: number; totalPages: number; total: number };

/** A product loaded for the editor's product-page preview, with its own design settings. */
export type ProductPreview = {
  productId: string;
  slug: string;
  name: string;
  /** The product as the product blocks read it (`toProductResource`): the same shape the live storefront renders. */
  resource: Record<string, unknown>;
  /** Draft and live settings with the revision; null when the API could not provide them (see `presentationError`). */
  presentation: PresentationDetail | null;
  presentationError: string | null;
};
