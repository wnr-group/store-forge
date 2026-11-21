import { registerEditorAdapter } from "../adapter";
import { createEngineAdapter } from "./engine";

/**
 * Stride (the Sport look). Its sections are drawn by the look itself, so only these pass their blocks through the engine's
 * block renderer, or put the style hook on the block's own element:
 *   hero          the call-to-action buttons (slides are the hero's own data and carry no style)
 *   main-product  the product page's title, price, description and other info blocks
 *   multicolumn   each column card
 *   image-with-text   its heading, text and call-to-action button; promotional-banner   those and the step cards
 *   announcement-bar, footer, image-banner, logo-list, testimonials, rich-text, collection-banner   the engine's own blocks
 *   header (menu links and button), collapsible-content (rows)   marked by the look: they can be hidden on a device
 * Every section can still be styled as a whole (background, spacing, size, corners, opacity, visibility); the sticky header
 * only changes fonts and can be hidden. Other blocks keep their content settings; style controls appear for them only when Stride draws them with the hook.
 */
registerEditorAdapter(
  createEngineAdapter({
    id: "stride",
    name: "Stride",
    looks: ["sport"],
    blockSections: ["announcement-bar", "collection-banner", "footer", "hero", "image-banner", "image-with-text", "logo-list", "main-product", "multicolumn", "promotional-banner", "rich-text", "testimonials"],
    blockTypes: { "image-with-text": ["button", "heading", "text"], "promotional-banner": ["button", "heading", "text", "column"] },
    hideOnly: { header: ["link", "button"], "collapsible-content": ["collapsible-item"] },
    // Its slides carry their own heading and text; the hero draws only the buttons added to it.
    notDrawn: { hero: ["heading", "text"] },
  }),
);
