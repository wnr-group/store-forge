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
      "logo-list", "main-product", "multicolumn", "promotional-banner", "rich-text", "testimonials",
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
    blockSections: ["collapsible-content", "collection-banner", "footer", "header", "hero", "image-banner", "image-with-text", "logo-list", "main-product", "multicolumn", "promotional-banner", "testimonials"],
  }),
);
registerEditorAdapter(
  createEngineAdapter({
    id: "marketplace",
    name: "Marketplace",
    looks: ["market"],
    // Marketplace draws its own header, footer and banners but marks the promotional banner's blocks itself.
    blockSections: ["collapsible-content", "hero", "image-banner", "image-with-text", "logo-list", "main-product", "multicolumn", "promotional-banner", "testimonials"],
  }),
);

// Stride (sport look).
import "./stride";
