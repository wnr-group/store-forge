"use client";

import { useContext, useMemo } from "react";
import { themeTargetMarker } from "@/lib/editor/theme-target-marker";
import { WORDING_GROUP, wordingOf, type Wording, type WordingKey } from "@/lib/storefront/wording";
import { StorefrontContext } from "./context";

/**
 * The store's shopping wording (see lib/storefront/wording.ts), read from the theme the storefront is being drawn with. Components
 * that are not handed the render context (the bag drawer, Add to bag, the card buttons) use this. Outside a storefront (no
 * context, as in a unit test) it returns the default wording instead of failing.
 */
export function useWording(): Wording {
  const theme = useContext(StorefrontContext)?.theme;
  return useMemo(() => wordingOf(theme), [theme]);
}

/**
 * The attribute that makes a wording-driven element (the bag drawer, a card's Add to bag button) open its setting in the Theme
 * editor when clicked. Only the editor and the preview get it; the live storefront's markup is unchanged.
 */
export function useWordingMarker(key: WordingKey): Record<string, string> {
  return themeTargetMarker(useContext(StorefrontContext)?.mode, WORDING_GROUP, key);
}
