import { FooterSection } from "../../sections/footer";
import type { SectionProps } from "..";

/** The navy the Stride theme ships its footer in, and the deeper indigo the LESPARO footer uses. */
const STOCK_NAVY = "#0d1033";
const INDIGO_DEEP = "#12164c";

/**
 * Sport footer: the engine's footer in LESPARO's deep indigo. Only a footer still on the theme's stock navy (or with no colour
 * set) is moved; a colour the merchant chose in the editor is left alone.
 */
export function SportFooter({ node, context, sectionId }: SectionProps) {
  const set = String(node.settings?.backgroundColor ?? "").trim().toLowerCase();
  const settings = !set || set === STOCK_NAVY ? { ...node.settings, backgroundColor: INDIGO_DEEP, textColor: node.settings?.textColor ?? "#ffffff" } : node.settings;
  return <FooterSection node={{ ...node, settings }} context={context} sectionId={sectionId} />;
}
