import type { PreviewStoreData } from "./types";

/**
 * Demo preview content. Used only when the merchant switches a preview to "Demo": never saved, never sent to the API,
 * never mixed with the store's own products, and the names say plainly that it is sample content.
 */
const names = ["Sample product one", "Sample product two", "Sample product three", "Sample product four", "Sample product five", "Sample product six", "Sample product seven", "Sample product eight"];

export const SAMPLE_PRODUCTS: PreviewStoreData["store"]["products"] = names.map((name, i) => ({
  name,
  slug: `sample-${i + 1}`,
  short_description: "Your product description appears here.",
  price_minor: 99_900 + i * 20_000,
  compare_at_price_minor: i % 3 === 0 ? 129_900 + i * 20_000 : null,
  image_path: null,
}));

export const SAMPLE_COLLECTIONS: PreviewStoreData["collections"] = ["New arrivals", "Best sellers", "Sale", "Gifts"].map((name, i) => ({
  id: `sample-collection-${i + 1}`,
  name,
  slug: `sample-collection-${i + 1}`,
  description: null,
  image_path: null,
  product_count: 6 + i,
}));

/** Demo content pages, only for exploring a theme. */
export const SAMPLE_CONTENT_PAGES: NonNullable<PreviewStoreData["contentPages"]> = [
  { title: "About us", slug: "about", body: "# Our story\n\nWe make things we are proud of, and we ship them with care.\n\nEvery order is packed by hand." },
  { title: "Contact", slug: "contact", body: "We reply within one working day.\n\nWrite to us any time." },
];
