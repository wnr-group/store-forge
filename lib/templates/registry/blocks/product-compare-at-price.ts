import type { BlockDefinition } from "../../engine/descriptors";

export const productCompareAtPriceBlock: BlockDefinition = {
  type: "product-compare-at-price",
  name: "Compare-at Price & Savings",
  settings: [
    {
      id: "showBadge",
      type: "toggle",
      label: "Show Sale Badge",
      default: true,
    },
    {
      id: "badgeText",
      type: "text",
      label: "Badge Text",
      default: "Sale",
    },
  ],
};
