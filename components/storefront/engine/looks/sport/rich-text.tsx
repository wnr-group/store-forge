import { RichTextSection } from "../../sections/rich-text";
import type { SectionProps } from "..";
import { SportHeroBanner } from "./hero-banner";

/**
 * Sport rich text. The generated "All products" and search pages start with a section called `intro` (a heading and a note):
 * that one becomes the dark banner. Every other rich-text section is the engine's own.
 */
export function SportRichText(props: SectionProps) {
  const { node, context, sectionId } = props;
  if (sectionId !== "intro") return <RichTextSection {...props} />;
  const blocks = node.blocks ?? {};
  const title = String(blocks.title?.settings?.text ?? "");
  const note = String(blocks.note?.settings?.content ?? "");
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview ? { "data-sf-section": "intro" } : undefined;
  if (!title) return <RichTextSection {...props} />;
  const search = title.startsWith("Search");
  return <SportHeroBanner eyebrow={search ? "Search" : "Catalogue"} title={title} text={note || undefined} crumbs={[{ label: "Home", href: "/" }, { label: title }]} sfProps={sfProps} />;
}
