import type { StorefrontLook } from "..";
import { SportAnnouncementBar } from "./announcement-bar";
import { SportCollapsibleContent } from "./collapsible-content";
import { SportCollectionBanner } from "./collection-banner";
import { SportCollectionList } from "./collection-list";
import { SportFeaturedCollection } from "./featured-collection";
import { SportHeader } from "./header";
import { SportHero } from "./hero";
import { SportImageWithText } from "./image-with-text";
import { SportMainProduct } from "./main-product";
import { SportMulticolumn } from "./multicolumn";
import { SportProductGrid } from "./product-grid";
import { SportPromotionalBanner } from "./promotional-banner";
import { SportRelatedProducts } from "./related-products";
import { SportRichText } from "./rich-text";

/**
 * The Sport look (the Stride theme): white page, navy primary, yellow accent, indigo secondary, heavy slanted capitals,
 * pill controls, rounded 4:5 product cards and a hover mega menu. It draws the sections that define the look; every other
 * section (footer, testimonials, ...) is the engine's own and picks up the theme's colours and fonts.
 */
export const sportLook: StorefrontLook = {
  id: "sport",
  cart: true,
  sections: {
    "announcement-bar": SportAnnouncementBar,
    header: SportHeader,
    hero: SportHero,
    "collection-list": SportCollectionList,
    "featured-collection": SportFeaturedCollection,
    "image-with-text": SportImageWithText,
    multicolumn: SportMulticolumn,
    "collapsible-content": SportCollapsibleContent,
    "promotional-banner": SportPromotionalBanner,
    "collection-banner": SportCollectionBanner,
    "rich-text": SportRichText,
    "product-grid": SportProductGrid,
    "main-product": SportMainProduct,
    "related-products": SportRelatedProducts,
  },
};
