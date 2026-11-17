import { RichTextSection } from "../../sections/rich-text";
import type { SectionProps } from "..";
import { MarketPageHead } from "./page-head";

/**
 * Market rich text. The generated "All products" and search pages start with a section called `intro` (a heading and a note):
 * that one becomes the page head. Every other rich-text section is the engine's own.
 */
export function MarketRichText(props: SectionProps) {
  const { node, context, sectionId } = props;
  if (sectionId !== "intro") return <RichTextSection {...props} />;
  const blocks = node.blocks ?? {};
  const title = String(blocks.title?.settings?.text ?? "");
  const note = String(blocks.note?.settings?.content ?? "");
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview ? { "data-sf-section": "intro" } : undefined;
  if (!title) return <RichTextSection {...props} />;
  return <MarketPageHead title={title} text={note || undefined} crumbs={[{ label: "Home", href: "/" }, { label: title }]} sfProps={sfProps} />;
}
