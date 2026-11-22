import type { SectionProps } from "..";
import { MarketPageHead } from "./page-head";
import { renderBlockComponent } from "../../blocks";
import { WRAP } from "./ui";
import { cn } from "@/lib/utils";

/** Market collection page head: breadcrumbs, the collection name and its description. */
export function MarketCollectionBanner({ node, context, sectionId }: SectionProps) {
  const c = context.resource as { name?: string; description?: string | null } | undefined;
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : undefined;
  if (!c?.name) return null;
  const showText = Boolean(node.settings?.showCollectionDescription ?? true);
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const head = <MarketPageHead title={c.name} text={showText ? (c.description ?? undefined) : undefined} crumbs={[{ label: "Home", href: "/" }, { label: "Categories", href: "/collections" }, { label: c.name }]} sfProps={sfProps} />;
  if (ids.length === 0) return head;
  return (
    <>
      {head}
      <div className={cn(WRAP, "flex flex-col gap-2 pt-3")}>{ids.map((id) => renderBlockComponent(blocks[id], context, id))}</div>
    </>
  );
}
