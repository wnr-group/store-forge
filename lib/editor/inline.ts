import type { ComponentNode } from "@/lib/templates/document";
import type { ComponentRegistry } from "@/lib/templates/engine/descriptors";
import type { EditorState } from "@/lib/themes/editor/state";
import { setSetting, setTextOverride } from "@/lib/themes/editor/state";
import { findSettingForClick } from "./locate";
import { originalOf, readTextOverrides } from "./text";

/**
 * Where text edited directly on the page is saved. Words that a content setting holds (a heading, a button label ...) are written
 * to that setting, so the sidebar shows the same change. Words the theme writes itself have no setting and become a text
 * replacement for the section (`settings._text`). Pure, so the choice is tested.
 */
export type InlineTarget = { kind: "setting"; blockId?: string; key: string; from: string } | { kind: "override"; from: string };

function findNode(node: ComponentNode, id: string): ComponentNode | undefined {
  if (node.blocks?.[id]) return node.blocks[id];
  for (const child of Object.values(node.blocks ?? {})) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

/** `shown` is the text as the page displayed it, which may already be a replacement. */
export function locateInlineEdit(section: ComponentNode, blockId: string | undefined, registry: ComponentRegistry, shown: string): InlineTarget {
  const from = originalOf(readTextOverrides(section.settings), shown);
  const block = blockId ? findNode(section, blockId) : undefined;
  if (block) {
    const key = findSettingForClick([{ descriptors: registry.blocks[block.type]?.settings ?? [], settings: block.settings }], { texts: [from] });
    if (key) return { kind: "setting", blockId, key, from };
  }
  const key = findSettingForClick([{ descriptors: registry.sections[section.type]?.settings ?? [], settings: section.settings }], { texts: [from] });
  return key ? { kind: "setting", key, from } : { kind: "override", from };
}

export function applyInlineEdit(state: EditorState, docId: string, sectionId: string, target: InlineTarget, value: string): EditorState {
  if (target.kind === "override") return setTextOverride(state, docId, sectionId, target.from, value);
  let next = setSetting(state, docId, sectionId, target.blockId, target.key, value);
  // A replacement that was hiding the setting's words would hide this edit too.
  const section = (next.docs[docId]?.document as { sections?: Record<string, ComponentNode> } | undefined)?.sections?.[sectionId];
  if (section && readTextOverrides(section.settings).some((o) => o.from === target.from)) next = setTextOverride(next, docId, sectionId, target.from, undefined);
  return next;
}
