"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quickAddAction } from "@/app/s/[slug]/cart/actions";
import type { CardProduct } from "../engine/ui";
import { useOptionalCart } from "./cart-provider";

/** The theme editor listens for this to open the page of a product that needs options, as a click on its link would. */
export const PREVIEW_OPEN_EVENT = "sf-preview-open";

/**
 * "Add to bag" on a product card. On the live store the product is checked against the store's published data and added, or
 * its page opens when it needs an option. In the editor and theme preview (the bag is in memory) the same check runs, but a
 * product the live store does not know yet (demo content, a store that is not published) is added from the card's own data,
 * and "needs options" opens the product in the editor instead of leaving it.
 */
export function useQuickAdd(product: CardProduct, href: string | null) {
  const cart = useOptionalCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const addFromCard = () => {
    cart?.add(
      {
        productSlug: product.slug,
        variantId: null,
        name: product.name,
        variantTitle: null,
        imagePath: product.image_path ?? null,
        unitPriceMinor: product.price_minor,
        compareAtMinor: product.compare_at_price_minor ?? null,
      },
      { openDrawer: false },
    );
  };

  const addToBag = async () => {
    if (!cart || busy) return;
    setBusy(true);
    try {
      const result = await quickAddAction({ storeSlug: cart.storeSlug, productSlug: product.slug });
      if (result.status === "ok") cart.add(result.item, { openDrawer: false });
      else if (result.status === "options") {
        if (cart.preview) window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_EVENT, { detail: { href: href ?? `/products/${product.slug}` } }));
        else if (href) router.push(href);
      } else if (result.status === "unavailable") cart.notify(`${product.name} is sold out`);
      else if (cart.preview) addFromCard();
      else if (result.status === "gone") cart.notify(`${product.name} is no longer available`);
      else cart.notify("Could not add this item. Please try again.");
    } catch {
      if (cart.preview) addFromCard();
      else cart.notify("Could not add this item. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return { cart, busy, addToBag };
}
