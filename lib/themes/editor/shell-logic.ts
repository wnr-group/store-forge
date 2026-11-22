import type { ComponentNode } from "@/lib/templates/document";
import type { StyleDevice } from "@/lib/editor/style";
import type { ThemeKind } from "@/lib/themes/types";
import type { EditorState } from "./state";

/** Pure rules of the editor shell (save status, autosave pacing, page order). Moved out of editor-shell.tsx unchanged. */

export type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict" | "invalid";
/** What the server round trip is doing; the visible status is derived from this and the document state. */
export type SaveState = "idle" | "saving" | "error" | "conflict";
export type PreviewDevice = "desktop" | "tablet" | "mobile";

export const AUTOSAVE_MS = 1500;
export const MAX_AUTOSAVE_RETRIES = 3;

export const PAGE_LABEL: Partial<Record<ThemeKind, string>> = { index: "Home page", product: "Product page", collection: "Collection page" };
/** The preview device a style change is written for. */
export const STYLE_DEVICE: Record<PreviewDevice, StyleDevice> = { desktop: "base", tablet: "tablet", mobile: "mobile" };

export function findNode(node: ComponentNode, id: string): ComponentNode | undefined {
  if (node.blocks?.[id]) return node.blocks[id];
  for (const child of Object.values(node.blocks ?? {})) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function deriveSaveStatus(saveState: SaveState, hasLocalProblems: boolean, dirtyCount: number): SaveStatus {
  return saveState === "conflict" ? "conflict" : saveState === "saving" ? "saving" : saveState === "error" ? "error" : hasLocalProblems ? "invalid" : dirtyCount > 0 ? "unsaved" : "saved";
}

/** Debounced autosave: the pause before the next save, or null when none should be scheduled (a failed save retries a few times with a growing pause). */
export function autosaveDelay(status: SaveStatus, retries: number): number | null {
  if (status !== "unsaved" && status !== "error") return null;
  if (status === "error" && retries >= MAX_AUTOSAVE_RETRIES) return null;
  return status === "error" ? Math.min(30_000, 4000 * 2 ** retries) : AUTOSAVE_MS;
}

/** The server names fields as `<kind>.<path>`; the panel wants the path alone. */
export function mapDraftFieldErrors(kind: string, fieldErrors: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, message] of Object.entries(fieldErrors)) mapped[key.startsWith(`${kind}.`) ? key.slice(kind.length + 1) : key] = message;
  return mapped;
}

/** The page being edited first, then every other draft: the order a clicked section is looked up in. */
export function lookupOrder(s: Pick<EditorState, "pageId" | "docs">): string[] {
  return [s.pageId, ...Object.keys(s.docs).filter((id) => id !== s.pageId)];
}
