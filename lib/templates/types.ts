export type StorefrontProduct = {
  name: string;
  slug: string;
  short_description: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  image_path: string | null;
};

/** The public-safe store data a template may render (what get_public_storefront() returns, minus settings). */
export type StorefrontData = {
  name: string;
  slug: string;
  description: string | null;
  logo_path: string | null;
  currency: string;
  products: StorefrontProduct[];
};

/** Settings as stored (camelCase), or built from unsaved form values for the preview. */
export type SavedTemplateSettings = {
  templateKey: string;
  accentColor: string | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  heroImagePath: string | null;
};

/** The `template` object inside get_public_storefront(). */
export type PublicTemplate = {
  key: string;
  accent_color: string | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  hero_image_path: string | null;
};

/** What a template renders: fallbacks already applied. */
export type ResolvedTemplateSettings = {
  accentColor: string | null;
  heading: string;
  subheading: string | null;
  heroImageUrl: string | null;
};

export type TemplateProps = { store: StorefrontData; settings: ResolvedTemplateSettings };
