import { RichTextSection } from "../../sections/rich-text";
import type { SectionProps } from "..";
import { SearchBox, searchTermOf } from "../../search-box";
import { MarketPageHead } from "./page-head";
import { blockMarkers } from "../../markers";

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
  const term = searchTermOf(title);
  const head = <MarketPageHead title={title} text={note || undefined} crumbs={[{ label: "Home", href: "/" }, { label: title }]} sfProps={sfProps} titleOv={blockMarkers("title", false, blocks.title)} textOv={blockMarkers("note", false, blocks.note)} />;
  if (term === null) return head;
  return (
    <>
      {head}
      <div className="mx-auto w-full max-w-[var(--sf-page-width,97.5rem)] px-3 pt-3 sm:px-4 lg:px-5">
        <SearchBox term={term} basePath={String(context.basePath ?? "")} variant="market" contained={false} />
      </div>
    </>
  );
}
