import type { SectionProps } from "..";
import { MarketPageHead } from "./page-head";

/** Market collection page head: breadcrumbs, the collection name and its description. */
export function MarketCollectionBanner({ node, context, sectionId }: SectionProps) {
  const c = context.resource as { name?: string; description?: string | null } | undefined;
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : undefined;
  if (!c?.name) return null;
  const showText = Boolean(node.settings?.showCollectionDescription ?? true);
  return <MarketPageHead title={c.name} text={showText ? (c.description ?? undefined) : undefined} crumbs={[{ label: "Home", href: "/" }, { label: "Categories", href: "/collections" }, { label: c.name }]} sfProps={sfProps} />;
}
