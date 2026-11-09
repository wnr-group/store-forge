/**
 * Pure variant selection logic for the Storefront template engine (AC-REN-009).
 * Maps merchant option selections to product variants, dynamically updating
 * price, compare-at price, SKU, and image URL without server round trips.
 */

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface ProductVariantSummary {
  id: string;
  title: string;
  price_minor: number;
  compare_at_price_minor?: number | null;
  sku?: string | null;
  image_path?: string | null;
  option_values: Record<string, string>;
}

export interface ProductWithVariants {
  name: string;
  price_minor: number;
  compare_at_price_minor?: number | null;
  sku?: string | null;
  image_path?: string | null;
  options?: ProductOption[];
  variants?: ProductVariantSummary[];
}

export type SelectedOptions = Record<string, string>;

/**
 * Finds the variant matching every selected option key and value.
 */
export function resolveVariant(
  variants: ProductVariantSummary[] | undefined,
  selectedOptions: SelectedOptions,
): ProductVariantSummary | undefined {
  if (!variants || variants.length === 0) return undefined;

  const selectedEntries = Object.entries(selectedOptions);
  if (selectedEntries.length === 0) return undefined;

  return variants.find((v) => {
    return selectedEntries.every(([optName, optVal]) => {
      return v.option_values[optName] === optVal;
    });
  });
}

/**
 * Resolves effective display details for a product given user's chosen options.
 * When a variant matches, its price, SKU, and image take precedence;
 * otherwise it falls back to the parent product's base details.
 */
export function resolveSelectedProductDetails(
  product: ProductWithVariants,
  selectedOptions: SelectedOptions,
): {
  selectedVariant?: ProductVariantSummary;
  price_minor: number;
  compare_at_price_minor: number | null;
  sku: string | null;
  image_path: string | null;
} {
  const variant = resolveVariant(product.variants, selectedOptions);

  if (variant) {
    return {
      selectedVariant: variant,
      price_minor: variant.price_minor,
      compare_at_price_minor: variant.compare_at_price_minor ?? null,
      sku: variant.sku ?? product.sku ?? null,
      image_path: variant.image_path ?? product.image_path ?? null,
    };
  }

  return {
    selectedVariant: undefined,
    price_minor: product.price_minor,
    compare_at_price_minor: product.compare_at_price_minor ?? null,
    sku: product.sku ?? null,
    image_path: product.image_path ?? null,
  };
}
