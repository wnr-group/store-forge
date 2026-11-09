import type { BlockDefinition } from "../../engine/descriptors";

export const productTypeBlock: BlockDefinition = {
  type: "product-type",
  name: "Product Type",
  settings: [
    {
      id: "prefix",
      type: "text",
      label: "Type Prefix Label",
      default: "Type:",
    },
    {
      id: "showLabel",
      type: "toggle",
      label: "Show Prefix Label",
      default: true,
    },
  ],
};
