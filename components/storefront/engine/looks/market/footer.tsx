import { FooterSection } from "../../sections/footer";
import type { SectionProps } from "..";

/** The ink the Market theme ships its footer in. */
const INK = "#0d1420";

/**
 * Market footer: the engine footer on the theme dark ink, with room under it for the phone tab bar of the Market header
 * (which is fixed to the foot of the screen). A colour the merchant chose in the editor is left alone.
 */
export function MarketFooter({ node, context, sectionId }: SectionProps) {
  const set = String(node.settings?.backgroundColor ?? "").trim();
  const settings = set ? node.settings : { ...node.settings, backgroundColor: INK, textColor: node.settings?.textColor ?? "#ffffff" };
  return (
    <>
      <FooterSection node={{ ...node, settings }} context={context} sectionId={sectionId} />
      <div aria-hidden className="h-14 lg:hidden" style={{ backgroundColor: String(settings?.backgroundColor ?? INK) }} />
    </>
  );
}
