import type { ComponentType } from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { LookId } from "@/lib/templates/looks";
import { lookOf } from "@/lib/templates/engine/theme-style";
import type { RenderContext } from "../types";
import type { CardProduct } from "../ui";
import { boutiqueLook } from "./boutique";
import { BoutiqueProductCard } from "./boutique/product-card";
import { marketLook } from "./market";
import { MarketProductCard } from "./market/product-card";
import { sportLook } from "./sport";
import { SportProductCard } from "./sport/product-card";

export type SectionProps = { node: ComponentNode; context: RenderContext; sectionId?: string };
export type SectionComponent = ComponentType<SectionProps>;
export type ProductCardProps = { product: CardProduct; currency: string; href?: string | null; tone?: "light" | "dark"; priority?: boolean };
export type ProductCardComponent = ComponentType<ProductCardProps>;

/**
 * A storefront look: the section components a theme draws itself with. Sections a look does not list fall back to the
 * engine's own component, so a look only implements what it wants to look different. A look receives the same
 * `RenderContext` (store, collections, products, theme) as every other, so it never fetches or owns tenant data.
 */
export interface StorefrontLook {
  id: LookId;
  /** True when the look draws the bag icon and the "Add to bag" control, so the store has a working cart. */
  cart?: boolean;
  /** The product card the look draws, for pages (such as the wishlist) that list products outside a section. */
  card?: ProductCardComponent;
  sections: Partial<Record<string, SectionComponent>>;
}

/** Every registered look. Add an id to `lib/templates/looks.ts`, then its components here. */
export const LOOKS: Record<LookId, StorefrontLook> = {
  standard: { id: "standard", sections: {} },
  boutique: { ...boutiqueLook, card: BoutiqueProductCard },
  sport: { ...sportLook, card: SportProductCard },
  market: { ...marketLook, card: MarketProductCard },
};

/** The look's own component for a section type, if the theme's look draws that section itself. */
export function lookSection(theme: unknown, type: string, looks: Record<string, StorefrontLook> = LOOKS): SectionComponent | undefined {
  return looks[lookOf(theme)]?.sections[type];
}

/** Whether the theme's look has cart entry points (bag icon, add to bag). The bag page itself works for every store. */
export function lookHasCart(theme: unknown, looks: Record<string, StorefrontLook> = LOOKS): boolean {
  return looks[lookOf(theme)]?.cart === true;
}

/** The product card of the theme's look (the Boutique card when the look has none). */
export function lookCard(theme: unknown, looks: Record<string, StorefrontLook> = LOOKS): ProductCardComponent {
  return looks[lookOf(theme)]?.card ?? BoutiqueProductCard;
}
