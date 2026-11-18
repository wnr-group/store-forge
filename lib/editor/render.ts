import type { ComponentNode } from "@/lib/templates/document";
import { elementCss, isEmptyStyle, readStyle, type CssTarget } from "./style";

/** Sections that must stay a plain, sticky element in the page flow: wrapping one would break the sticky header. */
export const UNWRAPPED_SECTIONS: ReadonlySet<string> = new Set(["header"]);

export const hasStyleOverrides = (node: Pick<ComponentNode, "settings"> | undefined): boolean => !!node?.settings && !isEmptyStyle(readStyle(node.settings));

function collectBlocks(blocks: Record<string, ComponentNode> | undefined, out: CssTarget[]) {
  for (const [id, block] of Object.entries(blocks ?? {})) {
    if (hasStyleOverrides(block)) out.push({ id, style: readStyle(block.settings), textScope: true });
    collectBlocks(block.blocks, out);
  }
}

/** Every section and block of the given documents that carries style overrides (hidden ones too: they cost nothing). */
export function collectCssTargets(documents: readonly ({ sections?: Record<string, ComponentNode> } | null | undefined)[]): CssTarget[] {
  const out: CssTarget[] = [];
  for (const doc of documents) {
    for (const [id, section] of Object.entries(doc?.sections ?? {})) {
      if (hasStyleOverrides(section)) out.push({ id, style: readStyle(section.settings), textScope: false });
      collectBlocks(section.blocks, out);
    }
  }
  return out;
}

export const documentsCss = (documents: Parameters<typeof collectCssTargets>[0]): string => elementCss(collectCssTargets(documents));
