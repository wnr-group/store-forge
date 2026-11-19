import type { StorefrontLook } from "..";
import { BoutiqueAnnouncementBar } from "./announcement-bar";
import { BoutiqueCollapsibleContent } from "./collapsible-content";
import { BoutiqueCollectionList } from "./collection-list";
import { BoutiqueFeaturedCollection } from "./featured-collection";
import { BoutiqueHeader } from "./header";
import { BoutiqueHero } from "./hero";
import { BoutiqueImageWithText } from "./image-with-text";
import { BoutiqueMulticolumn } from "./multicolumn";
import { BoutiqueProductGrid } from "./product-grid";
import { BoutiquePromotionalBanner } from "./promotional-banner";
import { BoutiqueRelatedProducts } from "./related-products";
import { BoutiqueRichText } from "./rich-text";
import { BoutiqueTestimonials } from "./testimonials";

/**
 * The Boutique look (the Maison theme): ivory page, forest-green primary, display serif headings, pill buttons, 3:4
 * square-cornered product cards. It draws the sections whose presentation defines the look; every other section
 * (footer, product page, ...) is the engine's own and picks up the theme's colours and fonts.
 */
export const boutiqueLook: StorefrontLook = {
  id: "boutique",
  cart: true,
  sections: {
    "announcement-bar": BoutiqueAnnouncementBar,
    header: BoutiqueHeader,
    hero: BoutiqueHero,
    "collapsible-content": BoutiqueCollapsibleContent,
    "collection-list": BoutiqueCollectionList,
    "featured-collection": BoutiqueFeaturedCollection,
    "image-with-text": BoutiqueImageWithText,
    multicolumn: BoutiqueMulticolumn,
    "product-grid": BoutiqueProductGrid,
    "related-products": BoutiqueRelatedProducts,
    "rich-text": BoutiqueRichText,
    "promotional-banner": BoutiquePromotionalBanner,
    testimonials: BoutiqueTestimonials,
  },
};
