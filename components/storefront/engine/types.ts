import type { TemplateDocument } from "@/lib/templates/document";
import type { StorefrontData } from "@/lib/templates/types";
import type { ProductOption, ProductVariantSummary } from "@/lib/templates/variant-selection";

export type RenderMode = "public" | "preview" | "editor";

export interface CollectionSummary {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_path?: string | null;
  product_count?: number;
}

export interface ProductDetailData {
  id?: string;
  name: string;
  slug: string;
  short_description?: string | null;
  description_html?: string | null;
  price_minor: number;
  compare_at_price_minor?: number | null;
  sku?: string | null;
  type?: string | null;
  category?: string | null;
  category_id?: string | null;
  collection_id?: string | null;
  image_path?: string | null;
  images?: string[];
  options?: ProductOption[];
  variants?: ProductVariantSummary[];
  [key: string]: unknown;
}

export interface CollectionDetailData {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  image_path?: string | null;
  products?: {
    name: string;
    slug: string;
    short_description?: string | null;
    price_minor: number;
    compare_at_price_minor?: number | null;
    image_path?: string | null;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

export interface RenderContext {
  store: StorefrontData | {
    name: string;
    slug: string;
    description?: string | null;
    logo_path?: string | null;
    currency?: string;
    products?: {
      name: string;
      slug: string;
      short_description?: string | null;
      price_minor: number;
      compare_at_price_minor?: number | null;
      image_path?: string | null;
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  };
  resource?: ProductDetailData | CollectionDetailData | Record<string, unknown>;
  collections?: CollectionSummary[];
  theme?: Record<string, unknown>;
  mode?: RenderMode;
  selectedOptions?: Record<string, string>;
  onSelectOption?: (option: string, value: string) => void;
  [key: string]: unknown;
}

export interface TemplateRendererProps {
  document: TemplateDocument;
  context: RenderContext;
  mode?: RenderMode;
}
