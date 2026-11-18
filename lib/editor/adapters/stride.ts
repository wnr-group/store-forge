import { registerEditorAdapter } from "../adapter";
import { createEngineAdapter } from "./engine";

/**
 * Stride (the Sport look). Its sections are drawn by the look itself, so only these pass their blocks through the engine's
 * block renderer, or put the style hook on the block's own element:
 *   hero          the call-to-action buttons (slides are the hero's own data and carry no style)
 *   main-product  the product page's title, price, description and other info blocks
 *   multicolumn   each column card
 * Every section can still be styled as a whole (background, spacing, size, corners, opacity, visibility) except the sticky
 * header. Other blocks keep their content settings; style controls appear for them only when Stride draws them with the hook.
 */
registerEditorAdapter(
  createEngineAdapter({
    id: "stride",
    name: "Stride",
    looks: ["sport"],
    blockSections: ["hero", "main-product", "multicolumn"],
  }),
);
