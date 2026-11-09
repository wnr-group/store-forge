import type { BlockDefinition } from "../../engine/descriptors";

export const productSkuBlock: BlockDefinition = {
  type: "product-sku",
  name: "Product SKU",
  settings: [
    {
      id: "prefix",
      type: "text",
      label: "SKU Prefix Label",
      default: "SKU:",
    },
    {
      id: "showLabel",
      type: "toggle",
      label: "Show Prefix Label",
      default: true,
    },
  ],
};
