import type { SectionProps } from "..";
import { SportFaq, type FaqItem } from "./faq";

/** Sport FAQ section: the section's Collapsible Row blocks become the questions. */
export function SportCollapsibleContent({ node, context, sectionId }: SectionProps) {
  const blocks = node.blocks ?? {};
  const items: FaqItem[] = (node.block_order ?? Object.keys(blocks))
    .filter((id) => blocks[id]?.type === "collapsible-item" && !(blocks[id].disabled && context.mode === "public"))
    .map((id, i) => ({ id, question: String(blocks[id].settings?.heading ?? ""), answer: String(blocks[id].settings?.content ?? ""), open: Boolean(blocks[id].settings?.defaultOpen) || (i === 0 && Boolean(node.settings?.openFirstItem)) }));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : undefined;
  if (items.length === 0 && !isPreview) return null;
  return <SportFaq eyebrow={String(node.settings?.eyebrow ?? "")} heading={String(node.settings?.heading ?? "")} subheading={String(node.settings?.subheading ?? "")} ctaLabel={String(node.settings?.ctaLabel ?? "")} ctaLink={String(node.settings?.ctaLink ?? "/contact")} items={items} sfProps={sfProps} />;
}
