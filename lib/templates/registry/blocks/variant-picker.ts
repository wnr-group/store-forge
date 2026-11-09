import type { BlockDefinition } from "../../engine/descriptors";

export const variantPickerBlock: BlockDefinition = {
  type: "variant-picker",
  name: "Variant Picker",
  settings: [
    {
      id: "pickerType",
      type: "select",
      label: "Picker Style",
      default: "pills",
      options: [
        { label: "Pills / Buttons", value: "pills" },
        { label: "Dropdowns", value: "dropdown" },
      ],
    },
    {
      id: "showSku",
      type: "toggle",
      label: "Show Selected Variant SKU",
      default: true,
    },
    {
      id: "showInventory",
      type: "toggle",
      label: "Show Inventory Availability",
      default: false,
    },
  ],
};
