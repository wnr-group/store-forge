import type { BlockDefinition } from "../../engine/descriptors";

export const buttonBlock: BlockDefinition = {
  type: "button",
  name: "Button",
  settings: [
    {
      id: "label",
      type: "text",
      label: "Button Label",
      default: "Shop now",
    },
    {
      id: "link",
      type: "url",
      label: "Button Link",
      default: "/collections",
    },
    {
      id: "style",
      type: "select",
      label: "Style",
      default: "primary",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
        { label: "Outline", value: "outline" },
      ],
    },
    {
      id: "openInNewTab",
      type: "toggle",
      label: "Open in new tab",
      default: false,
    },
  ],
};
