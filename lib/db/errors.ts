import { AppError } from "@/lib/errors";

/** Messages from the whole error chain (Drizzle wraps the driver error in `cause`). */
export function errorChain(error: unknown): string {
  const parts: string[] = [];
  for (let e: unknown = error; e instanceof Error; e = e.cause) parts.push(e.message);
  return parts.join(" | ");
}

type Rule = { match: RegExp; error: () => AppError };

const field = (name: string, message: string) => ({ [name]: message });

/** Known constraint names -> messages that are safe to show. Anything else is rethrown (and logged by toFailure). */
const RULES: Rule[] = [
  { match: /products_tenant_id_slug_key/, error: () => new AppError("CONFLICT", "That URL handle is already used by another product.", field("slug", "This slug is already in use.")) },
  { match: /products_tenant_id_sku_key|product_variants_tenant_id_sku_key/, error: () => new AppError("CONFLICT", "That SKU is already used.", field("sku", "This SKU is already in use.")) },
  { match: /categories_tenant_id_slug_key/, error: () => new AppError("CONFLICT", "That URL handle is already used by another category.", field("slug", "This slug is already in use.")) },
  { match: /collections_tenant_id_slug_key/, error: () => new AppError("CONFLICT", "That URL handle is already used by another collection.", field("slug", "This slug is already in use.")) },
  { match: /customers_tenant_id_email_key/, error: () => new AppError("CONFLICT", "A customer with that email already exists.", field("email", "A customer with this email address already exists.")) },
  { match: /stores_slug_key/, error: () => new AppError("CONFLICT", "That store address is already taken.", field("slug", "This store address is already taken.")) },
  { match: /product_variants_product_id_options_key/, error: () => new AppError("VALIDATION", "Two variants have the same option combination.") },
  { match: /(product_variants|products)_quantity_check|inventory_adjustments_quantity_after_check/, error: () => new AppError("VALIDATION", "Stock cannot go below zero.") },
  { match: /product_images_one_primary_idx/, error: () => new AppError("VALIDATION", "A product can only have one primary image.") },
  { match: /categories_parent_check/, error: () => new AppError("VALIDATION", "A category cannot be its own parent.") },
  { match: /row-level security|permission denied/, error: () => new AppError("FORBIDDEN", "You do not have permission to do that.") },
];

/** Translates database errors into user-safe AppErrors; unknown errors pass through unchanged. */
export function mapDbError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  const msg = errorChain(error);
  for (const rule of RULES) if (rule.match.test(msg)) return rule.error();
  return error;
}

/** Runs `fn`, mapping known constraint failures to AppErrors. */
export async function mapErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapDbError(e);
  }
}
