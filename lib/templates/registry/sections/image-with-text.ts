import type { SectionDefinition } from "../../engine/descriptors";

export const imageWithTextSection: SectionDefinition = {
  type: "image-with-text",
  name: "Image with Text",
  category: "Content",
  accepts: ["heading", "text", "button"],
  maxChildren: 10,
  settings: [
    {
      id: "image",
      type: "image",
      label: "Featured Image",
      default: null,
    },
    {
      id: "imagePosition",
      type: "select",
      label: "Image Desktop Position",
      default: "left",
      options: [
        { label: "Image on Left", value: "left" },
        { label: "Image on Right", value: "right" },
      ],
    },
    {
      id: "imageWidth",
      type: "select",
      label: "Image Column Width",
      default: "medium",
      options: [
        { label: "Small (33%)", value: "small" },
        { label: "Medium (50%)", value: "medium" },
        { label: "Large (66%)", value: "large" },
      ],
    },
  ],
};
