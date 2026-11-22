import { createEngineAdapter } from "./engine";
import { registerEditorAdapter } from "../adapter";

export { adapterForLook, lookOf } from "../adapter";

/**
 * Which sections draw their blocks through the engine's block renderer (and so carry the style hook), per look. A section a
 * look draws by itself, reading its blocks as plain data, cannot be styled block by block and is left out: the editor shows no
 * style controls there rather than controls that would do nothing.
 */

// Standard look: the engine's own sections.
registerEditorAdapter(
  createEngineAdapter({
    id: "engine",
    name: "Standard",
    looks: ["standard"],
    blockSections: [
      "announcement-bar", "collapsible-content", "collection-banner", "footer", "header", "hero", "image-banner", "image-with-text",
      "logo-list", "main-product", "multicolumn", "promotional-banner", "rich-text", "testimonials", "trust-badges",
    ],
  }),
  { asFallback: true },
);

// Maison (boutique) and Marketplace (market): draw only a few sections themselves.
registerEditorAdapter(
  createEngineAdapter({
    id: "maison",
    name: "Maison",
    looks: ["boutique"],
    // Sections Maison draws through the engine's blocks (its own hero, header, promotional banner) or marks itself (testimonials).
    blockSections: ["announcement-bar", "collapsible-content", "collection-banner", "footer", "header", "hero", "image-banner", "image-with-text", "logo-list", "main-product", "multicolumn", "promotional-banner", "rich-text", "testimonials", "trust-badges"],
    // Maison's hero is a single composition; it never draws slides.
    notDrawn: { hero: ["hero-slide"] },
  }),
);
registerEditorAdapter(
  createEngineAdapter({
    id: "marketplace",
    name: "Marketplace",
    looks: ["market"],
    // Marketplace draws its own header (menu links and button, marked by the header itself) and banners; its footer, rich text, announcement bar and collection banner use the engine's blocks.
    blockSections: ["announcement-bar", "collapsible-content", "collection-banner", "footer", "hero", "image-banner", "image-with-text", "logo-list", "main-product", "multicolumn", "promotional-banner", "rich-text", "testimonials", "trust-badges"],
    hideOnly: { header: ["link", "button"] },
    // Its slides carry their own heading and text; the hero draws only the buttons added to it.
    notDrawn: { hero: ["heading", "text"] },
  }),
);

// Stride (sport look).
import "./stride";
