import type { StorefrontLook } from "..";
import { MarketAnnouncementBar } from "./announcement-bar";
import { MarketCollapsibleContent } from "./collapsible-content";
import { MarketCollectionBanner } from "./collection-banner";
import { MarketCollectionList } from "./collection-list";
import { MarketFeaturedCollection } from "./featured-collection";
import { MarketFooter } from "./footer";
import { MarketHeader } from "./header";
import { MarketHero } from "./hero";
import { MarketImageWithText } from "./image-with-text";
import { MarketMainProduct } from "./main-product";
import { MarketMulticolumn } from "./multicolumn";
import { MarketProductGrid } from "./product-grid";
import { MarketPromotionalBanner } from "./promotional-banner";
import { MarketRelatedProducts } from "./related-products";
import { MarketRichText } from "./rich-text";

/**
 * The Market look (the Marketplace theme): a dense, shop-first layout on a light grey page. A dark two-row header with a wide
 * search field, a rounded banner hero, category shortcut tiles, horizontally scrolling product shelves on white panels,
 * bordered product cards with an orange "Add to cart", a filter panel on listings, a three-column product page with a buy
 * box, and a dark footer. Every other section is the engine own and picks up the theme colours and fonts.
 */
export const marketLook: StorefrontLook = {
  id: "market",
  cart: true,
  sections: {
    "announcement-bar": MarketAnnouncementBar,
    header: MarketHeader,
    footer: MarketFooter,
    hero: MarketHero,
    "collapsible-content": MarketCollapsibleContent,
    "image-with-text": MarketImageWithText,
    multicolumn: MarketMulticolumn,
    "collection-list": MarketCollectionList,
    "featured-collection": MarketFeaturedCollection,
    "promotional-banner": MarketPromotionalBanner,
    "collection-banner": MarketCollectionBanner,
    "rich-text": MarketRichText,
    "product-grid": MarketProductGrid,
    "main-product": MarketMainProduct,
    "related-products": MarketRelatedProducts,
  },
};
