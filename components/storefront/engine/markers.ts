import { overrideValue } from "@/lib/editor/style";
import type { ComponentNode } from "@/lib/templates/document";

/**
 * The attributes a block's root element carries: `data-sf-block` in the editor and preview (so a click selects it), and
 * `data-sf-ov` whenever the block has style overrides (so the generated stylesheet in `lib/editor/render.ts` can reach it,
 * on the live storefront too).
 */
export function blockMarkers(blockId: string | undefined, preview: boolean, node?: Pick<ComponentNode, "settings">): Record<string, string> {
  if (!blockId) return {};
  const out: Record<string, string> = {};
  if (preview) out["data-sf-block"] = blockId;
  if (node?.settings && node.settings._style) out["data-sf-ov"] = overrideValue(blockId);
  return out;
}
