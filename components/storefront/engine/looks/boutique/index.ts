import type { StorefrontLook } from "..";
import { BoutiqueAnnouncementBar } from "./announcement-bar";
import { BoutiqueCollectionList } from "./collection-list";
import { BoutiqueFeaturedCollection } from "./featured-collection";
import { BoutiqueHeader } from "./header";
import { BoutiqueHero } from "./hero";
import { BoutiqueProductGrid } from "./product-grid";
import { BoutiquePromotionalBanner } from "./promotional-banner";
import { BoutiqueRelatedProducts } from "./related-products";
import { BoutiqueRichText } from "./rich-text";
import { BoutiqueTestimonials } from "./testimonials";

/**
 * The Boutique look (the Karthika theme): ivory page, forest-green primary, display serif headings, pill buttons, 3:4
 * square-cornered product cards. It draws the sections whose presentation defines the look; every other section
 * (footer, testimonials, product page, ...) is the engine's own and picks up the theme's colours and fonts.
 */
export const boutiqueLook: StorefrontLook = {
  id: "boutique",
  cart: true,
  sections: {
    "announcement-bar": BoutiqueAnnouncementBar,
    header: BoutiqueHeader,
    hero: BoutiqueHero,
    "collection-list": BoutiqueCollectionList,
    "featured-collection": BoutiqueFeaturedCollection,
    "product-grid": BoutiqueProductGrid,
    "related-products": BoutiqueRelatedProducts,
    "rich-text": BoutiqueRichText,
    "promotional-banner": BoutiquePromotionalBanner,
    testimonials: BoutiqueTestimonials,
  },
};
