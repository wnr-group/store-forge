import type { CapabilityId } from "./style";

/**
 * The contract between the visual editor and a theme. The editor core never names a theme: it asks the adapter registered
 * for the store's look what each element supports, and shows exactly those controls. A new theme joins by registering an
 * adapter (see `adapters/`), not by changing the editor.
 */

export type ElementKind = "section" | "block";

/** What one element supports. `textScope`: its text properties reach the text inside it, not just inherit. */
export type ElementSpec = {
  label?: string;
  capabilities: readonly CapabilityId[];
  textScope: boolean;
};

export interface ThemeEditorAdapter {
  id: string;
  name: string;
  /** The storefront looks (`settings.brand.look`) this adapter serves. */
  looks: readonly string[];
  /** Style support of a section type, or null when its style cannot be overridden. */
  section(type: string): ElementSpec | null;
  /** Style support of a block type inside a section type, or null when the theme draws it without style hooks. */
  block(type: string, sectionType: string): ElementSpec | null;
  /**
   * Whether the theme draws this block type inside this section type at all. A block a look never draws cannot be seen, styled or
   * hidden, so the editor does not offer it there (a document that already holds one stays valid). Undefined = every accepted block is drawn.
   */
  drawsBlock?(type: string, sectionType: string): boolean;
  /** Section types merchants may add on a page (all registered ones by default). `undefined` = no restriction. */
  addableSections?: readonly string[];
}

const adapters = new Map<string, ThemeEditorAdapter>();
const byLook = new Map<string, ThemeEditorAdapter>();
let fallback: ThemeEditorAdapter | null = null;

/** Registers an adapter for its looks. The first adapter registered with `asFallback` serves looks nobody claimed. */
export function registerEditorAdapter(adapter: ThemeEditorAdapter, options: { asFallback?: boolean } = {}): void {
  adapters.set(adapter.id, adapter);
  for (const look of adapter.looks) byLook.set(look, adapter);
  if (options.asFallback && !fallback) fallback = adapter;
}

export function adapterForLook(look: unknown): ThemeEditorAdapter {
  const found = typeof look === "string" ? byLook.get(look) : undefined;
  const adapter = found ?? fallback;
  if (!adapter) throw new Error("No editor adapter registered. Import @/lib/editor/adapters first.");
  return adapter;
}

/** The look a theme-settings document selects, or undefined. */
export function lookOf(themeDocument: Record<string, unknown> | null | undefined): string | undefined {
  const settings = themeDocument?.settings as Record<string, Record<string, unknown>> | undefined;
  const look = settings?.brand?.look;
  return typeof look === "string" ? look : undefined;
}
