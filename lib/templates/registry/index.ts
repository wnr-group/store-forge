import type { ComponentRegistry } from "../engine/descriptors";

// Section definitions (18 approved sections)
import { announcementBarSection } from "./sections/announcement-bar";
import { headerSection } from "./sections/header";
import { footerSection } from "./sections/footer";
import { heroSection } from "./sections/hero";
import { imageBannerSection } from "./sections/image-banner";
import { richTextSection } from "./sections/rich-text";
import { imageWithTextSection } from "./sections/image-with-text";
import { multicolumnSection } from "./sections/multicolumn";
import { collapsibleContentSection } from "./sections/collapsible-content";
import { testimonialsSection } from "./sections/testimonials";
import { productGridSection } from "./sections/product-grid";
import { collectionListSection } from "./sections/collection-list";
import { featuredCollectionSection } from "./sections/featured-collection";
import { collectionBannerSection } from "./sections/collection-banner";
import { mainProductSection } from "./sections/main-product";
import { relatedProductsSection } from "./sections/related-products";
import { promotionalBannerSection } from "./sections/promotional-banner";
import { logoListSection } from "./sections/logo-list";
import { countdownSection } from "./sections/countdown";
import { trustBadgesSection } from "./sections/trust-badges";

// Block definitions (21 approved blocks)
import { headingBlock } from "./blocks/heading";
import { textBlock } from "./blocks/text";
import { buttonBlock } from "./blocks/button";
import { imageBlock } from "./blocks/image";
import { linkBlock } from "./blocks/link";
import { linkColumnBlock } from "./blocks/link-column";
import { socialLinkBlock } from "./blocks/social-link";
import { columnBlock } from "./blocks/column";
import { collapsibleItemBlock } from "./blocks/collapsible-item";
import { testimonialBlock } from "./blocks/testimonial";
import { groupBlock } from "./blocks/group";
import { productTitleBlock } from "./blocks/product-title";
import { productPriceBlock } from "./blocks/product-price";
import { productCompareAtPriceBlock } from "./blocks/product-compare-at-price";
import { productSkuBlock } from "./blocks/product-sku";
import { productTypeBlock } from "./blocks/product-type";
import { productCategoryBlock } from "./blocks/product-category";
import { productDescriptionBlock } from "./blocks/product-description";
import { variantPickerBlock } from "./blocks/variant-picker";
import { collapsibleInfoBlock } from "./blocks/collapsible-info";
import { socialShareBlock } from "./blocks/social-share";
import { heroSlideBlock } from "./blocks/hero-slide";
import { trustBadgeBlock } from "./blocks/trust-badge";

export function getRegistry(): ComponentRegistry {
  return {
    sections: {
      "announcement-bar": announcementBarSection,
      header: headerSection,
      footer: footerSection,
      hero: heroSection,
      "image-banner": imageBannerSection,
      "rich-text": richTextSection,
      "image-with-text": imageWithTextSection,
      multicolumn: multicolumnSection,
      "collapsible-content": collapsibleContentSection,
      testimonials: testimonialsSection,
      "product-grid": productGridSection,
      "collection-list": collectionListSection,
      "featured-collection": featuredCollectionSection,
      "collection-banner": collectionBannerSection,
      "main-product": mainProductSection,
      "related-products": relatedProductsSection,
      "promotional-banner": promotionalBannerSection,
      "logo-list": logoListSection,
      countdown: countdownSection,
      "trust-badges": trustBadgesSection,
    },
    blocks: {
      heading: headingBlock,
      text: textBlock,
      button: buttonBlock,
      image: imageBlock,
      link: linkBlock,
      "link-column": linkColumnBlock,
      "social-link": socialLinkBlock,
      column: columnBlock,
      "collapsible-item": collapsibleItemBlock,
      testimonial: testimonialBlock,
      group: groupBlock,
      "product-title": productTitleBlock,
      "product-price": productPriceBlock,
      "product-compare-at-price": productCompareAtPriceBlock,
      "product-sku": productSkuBlock,
      "product-type": productTypeBlock,
      "product-category": productCategoryBlock,
      "product-description": productDescriptionBlock,
      "variant-picker": variantPickerBlock,
      "collapsible-info": collapsibleInfoBlock,
      "social-share": socialShareBlock,
      "hero-slide": heroSlideBlock,
      "trust-badge": trustBadgeBlock,
    },
  };
}
