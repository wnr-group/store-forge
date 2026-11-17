import { Badge } from "@/components/ui/badge";
import type { PresentationState } from "@/lib/themes/types";

/** What the owner sees for a product's customization: the stored state, or "Unsaved" while edits are still local. */
export type ProductStatus = PresentationState | "unsaved";

const LABEL: Record<ProductStatus, string> = {
  default: "Not customized",
  draft: "Not published yet",
  published: "Published",
  published_with_changes: "Changes not published",
  unsaved: "Unsaved",
};

export const productStatusLabel = (status: ProductStatus): string => LABEL[status];

/**
 * `prefix` spells out what the status is about: this product's own settings, not the shared page layout, which has its own
 * status (the badge at the bottom of the editor and the notice in the Product panel).
 */
export function ProductStatusBadge({ status, className, prefix = false }: { status: ProductStatus; className?: string; prefix?: boolean }) {
  const variant = status === "default" ? "ghost" : status === "published" ? "outline" : "secondary";
  return <Badge variant={variant} className={className}>{prefix ? `Product settings: ${LABEL[status]}` : LABEL[status]}</Badge>;
}
