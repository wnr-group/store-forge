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
    blockSections: ["collapsible-content", "footer", "header", "hero", "image-banner", "image-with-text", "logo-list", "multicolumn", "promotional-banner", "testimonials"],
  }),
);
registerEditorAdapter(
  createEngineAdapter({
    id: "marketplace",
    name: "Marketplace",
    looks: ["market"],
    blockSections: ["collapsible-content", "hero", "image-banner", "image-with-text", "logo-list", "main-product", "multicolumn", "promotional-banner", "testimonials"],
  }),
);

// Stride (sport look).
import "./stride";
