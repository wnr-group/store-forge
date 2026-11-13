import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { safeUrl } from "@/lib/templates/engine/schema";
import { generateId } from "@/lib/templates/engine/tree-ids";

/**
 * The store's main menu is the list of `link` blocks of the header (shared "group_header" document). These helpers read
 * and write that list and leave every other block and setting of the header untouched.
 */

export const MAX_MENU_ITEMS = 12;
export const MAX_LABEL_LENGTH = 40;

export type MenuItem = { id: string; label: string; url: string; newTab: boolean };

/** The first header section of the document, if it has one. */
function headerEntry(doc: TemplateDocument): [string, ComponentNode] | null {
  const entry = (doc.order ?? Object.keys(doc.sections ?? {})).map((id) => [id, doc.sections?.[id]] as const).find(([, s]) => s?.type === "header");
  return entry?.[1] ? [entry[0], entry[1]] : null;
}

export function readMenu(doc: TemplateDocument): MenuItem[] | null {
  const entry = headerEntry(doc);
  if (!entry) return null;
  const [, header] = entry;
  const order = header.block_order ?? Object.keys(header.blocks ?? {});
  return order.flatMap((id) => {
    const block = header.blocks?.[id];
    if (!block || block.type !== "link") return [];
    return [{ id, label: String(block.settings?.label ?? ""), url: String(block.settings?.url ?? ""), newTab: block.settings?.openInNewTab === true }];
  });
}

export type MenuErrors = Record<string, { label?: string; url?: string }>;

/** Field errors by item id; an empty object means the menu can be saved. */
export function validateMenu(items: MenuItem[]): MenuErrors {
  const errors: MenuErrors = {};
  for (const item of items) {
    const label = item.label.trim();
    if (!label) errors[item.id] = { ...errors[item.id], label: "Enter a label." };
    else if (label.length > MAX_LABEL_LENGTH) errors[item.id] = { ...errors[item.id], label: `Use ${MAX_LABEL_LENGTH} characters or fewer.` };
    if (!safeUrl(item.url)) errors[item.id] = { ...errors[item.id], url: "Use a link starting with /, https://, mailto: or #." };
  }
  return errors;
}

/** A copy of the document with the menu replaced. Non-link blocks stay where they were, ahead of the links. */
export function writeMenu(doc: TemplateDocument, items: MenuItem[]): TemplateDocument {
  const entry = headerEntry(doc);
  if (!entry) return doc;
  const [sectionId, header] = entry;
  const oldOrder = header.block_order ?? Object.keys(header.blocks ?? {});
  const keep = oldOrder.filter((id) => header.blocks?.[id] && header.blocks[id].type !== "link");
  const blocks: Record<string, ComponentNode> = Object.fromEntries(keep.map((id) => [id, header.blocks[id]]));
  for (const item of items) {
    const previous = header.blocks?.[item.id];
    const settings: Record<string, unknown> = { ...(previous?.type === "link" ? previous.settings : {}), label: item.label.trim(), url: item.url.trim() };
    if (item.newTab) settings.openInNewTab = true;
    else delete settings.openInNewTab;
    blocks[item.id] = { type: "link", settings, blocks: {}, block_order: [] };
  }
  return {
    ...doc,
    sections: { ...doc.sections, [sectionId]: { ...header, blocks, block_order: [...keep, ...items.map((i) => i.id)] } },
  };
}

/** A new, empty menu item with an id that cannot clash with the ones in use. */
export function newMenuItem(taken: Iterable<string>, label = "", url = "/"): MenuItem {
  const used = new Set(taken);
  let id = generateId("nav");
  while (used.has(id)) id = generateId("nav");
  return { id, label, url, newTab: false };
}
