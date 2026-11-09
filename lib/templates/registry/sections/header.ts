import type { SectionDefinition } from "../../engine/descriptors";

export const headerSection: SectionDefinition = {
  type: "header",
  name: "Header Navigation",
  category: "Header",
  accepts: ["link", "button"],
  maxChildren: 10,
  settings: [
    {
      id: "logoImage",
      type: "image",
      label: "Custom Logo",
      default: null,
    },
    {
      id: "logoWidth",
      type: "range",
      label: "Logo Width (px)",
      default: 120,
      min: 40,
      max: 300,
      unit: "px",
    },
    {
      id: "menuAlignment",
      type: "select",
      label: "Menu Alignment",
      default: "left",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    {
      id: "sticky",
      type: "toggle",
      label: "Sticky Header",
      default: true,
    },
    {
      id: "showSeparator",
      type: "toggle",
      label: "Show Bottom Border Separator",
      default: true,
    },
  ],
};
