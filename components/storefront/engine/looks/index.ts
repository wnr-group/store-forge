import type { ComponentType } from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { LookId } from "@/lib/templates/looks";
import { lookOf } from "@/lib/templates/engine/theme-style";
import type { RenderContext } from "../types";
import { boutiqueLook } from "./boutique";

export type SectionProps = { node: ComponentNode; context: RenderContext; sectionId?: string };
export type SectionComponent = ComponentType<SectionProps>;

/**
 * A storefront look: the section components a theme draws itself with. Sections a look does not list fall back to the
 * engine's own component, so a look only implements what it wants to look different. A look receives the same
 * `RenderContext` (store, collections, products, theme) as every other, so it never fetches or owns tenant data.
 */
export interface StorefrontLook {
  id: LookId;
  /** True when the look draws the bag icon and the "Add to bag" control, so the store has a working cart. */
  cart?: boolean;
  sections: Partial<Record<string, SectionComponent>>;
}

/** Every registered look. Add an id to `lib/templates/looks.ts`, then its components here. */
export const LOOKS: Record<LookId, StorefrontLook> = {
  standard: { id: "standard", sections: {} },
  boutique: boutiqueLook,
};

/** The look's own component for a section type, if the theme's look draws that section itself. */
export function lookSection(theme: unknown, type: string, looks: Record<string, StorefrontLook> = LOOKS): SectionComponent | undefined {
  return looks[lookOf(theme)]?.sections[type];
}

/** Whether the theme's look has cart entry points (bag icon, add to bag). The bag page itself works for every store. */
export function lookHasCart(theme: unknown, looks: Record<string, StorefrontLook> = LOOKS): boolean {
  return looks[lookOf(theme)]?.cart === true;
}
