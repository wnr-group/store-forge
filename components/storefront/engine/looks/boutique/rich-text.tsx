import { RichTextSection } from "../../sections/rich-text";
import { SearchBox, searchTermOf } from "../../search-box";
import type { SectionProps } from "..";

/**
 * Boutique rich text: the engine's own, except that the generated search page (a section called `intro` titled "Search...")
 * gets a search field under its heading, so a shopper can search again without editing the address.
 */
export function BoutiqueRichText(props: SectionProps) {
  const { node, context, sectionId } = props;
  const term = sectionId === "intro" ? searchTermOf(String(node.blocks?.title?.settings?.text ?? "")) : null;
  if (term === null) return <RichTextSection {...props} />;
  return (
    <>
      <RichTextSection {...props} />
      <SearchBox term={term} basePath={String(context.basePath ?? "")} />
    </>
  );
}
