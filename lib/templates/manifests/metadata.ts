/**
 * The small hand-written part of the first-party manifests. Everything else (name, description, settings reference, accepted
 * children, allowed parents, image media use) is derived from the registry in `./index.ts`.
 */
import type { ManifestPermission } from "../manifest";

export type DataSource = "products" | "collections" | "cart" | "storefront";

export interface ComponentMeta {
  /** Blocks only: sections use `SectionDefinition.category`. */
  category?: string;
  displayRules: boolean;
  reusable: boolean;
  copyPaste: boolean;
  dataSources?: DataSource[];
  protectedParts?: string[];
  /** Overrides the derived page-level slot list (sections only). */
  allowedSlots?: string[];
  /** Approval gate: the component stays unavailable until an approval record with this feature key exists. */
  legalFeatureKey?: string;
  /** Wording key of the attestation a merchant must give (for uploaded content). */
  attestationWordingKey?: string;
  messageKeys?: string[];
}

export const DATA_SOURCE_PERMISSION: Record<DataSource, ManifestPermission> = {
  products: "products:read",
  collections: "collections:read",
  cart: "cart:read",
  storefront: "storefront:read",
};

const ok = { displayRules: true, reusable: true, copyPaste: true } as const;
/** Commerce-critical or structural singletons: never reusable, never copied, never hidden by a display rule. */
const fixed = { displayRules: false, reusable: false, copyPaste: false } as const;
const productBlock = { reusable: false, copyPaste: true, dataSources: ["products"] as DataSource[] };

export const SECTION_META: Record<string, ComponentMeta> = {
  "announcement-bar": { ...ok },
  header: { ...fixed, dataSources: ["storefront", "cart"], protectedParts: ["cart-link", "account-link"] },
  footer: { ...fixed, dataSources: ["storefront"], protectedParts: ["legal-links"] },
  hero: { ...ok },
  "image-banner": { ...ok },
  "rich-text": { ...ok },
  "image-with-text": { ...ok },
  multicolumn: { ...ok },
  "collapsible-content": { ...ok },
  testimonials: { ...ok },
  "product-grid": { ...ok, dataSources: ["products", "collections"] },
  "collection-list": { ...ok, dataSources: ["collections"] },
  "featured-collection": { ...ok, dataSources: ["collections", "products"] },
  "collection-banner": { ...ok, dataSources: ["collections"] },
  "main-product": { ...fixed, dataSources: ["products", "cart"], protectedParts: ["price", "variant-picker", "add-to-cart"] },
  "related-products": { ...ok, dataSources: ["products"] },
  "promotional-banner": { ...ok },
  "logo-list": { ...ok },
  countdown: {
    ...ok,
    legalFeatureKey: "countdown",
    protectedParts: ["end-message"],
    messageKeys: ["countdown.announce.long", "countdown.announce.day", "countdown.announce.hour", "countdown.announce.tenMinutes", "countdown.announce.minute", "countdown.announce.ended"],
  },
  "trust-badges": {
    ...ok,
    legalFeatureKey: "trust_badges",
    attestationWordingKey: "badge_upload",
    protectedParts: ["disclaimer"],
    messageKeys: ["trustBadges.disclaimer"],
  },
};

export const BLOCK_META: Record<string, ComponentMeta> = {
  heading: { category: "Text", ...ok },
  text: { category: "Text", ...ok },
  button: { category: "Action", ...ok },
  image: { category: "Media", ...ok },
  link: { category: "Navigation", ...ok },
  "link-column": { category: "Navigation", ...ok },
  "social-link": { category: "Social", ...ok },
  column: { category: "Layout", ...ok },
  "collapsible-item": { category: "Content", ...ok },
  testimonial: { category: "Content", ...ok },
  group: { category: "Layout", ...ok },
  "product-title": { category: "Product", displayRules: false, ...productBlock, protectedParts: ["title"] },
  "product-price": { category: "Product", displayRules: false, ...productBlock, protectedParts: ["price"] },
  "product-compare-at-price": { category: "Product", displayRules: false, ...productBlock, protectedParts: ["compare-at-price"] },
  "product-sku": { category: "Product", displayRules: true, ...productBlock },
  "product-type": { category: "Product", displayRules: true, ...productBlock },
  "product-category": { category: "Product", displayRules: true, ...productBlock },
  "product-description": { category: "Product", displayRules: true, ...productBlock },
  "variant-picker": { category: "Product", displayRules: false, ...productBlock, dataSources: ["products", "cart"], protectedParts: ["variant-selection"] },
  "collapsible-info": { category: "Product", displayRules: true, ...productBlock },
  "social-share": { category: "Social", displayRules: true, reusable: false, copyPaste: true, dataSources: ["products"] },
  "hero-slide": { category: "Banners", ...ok },
  "trust-badge": {
    category: "Content",
    ...ok,
    legalFeatureKey: "trust_badges",
    attestationWordingKey: "badge_upload",
    messageKeys: ["trustBadges.disclaimer", "trustBadges.preset.freeShipping", "trustBadges.preset.easyReturns", "trustBadges.preset.securePackaging", "trustBadges.preset.qualityChecked"],
  },
};
