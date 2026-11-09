import type { BlockDefinition } from "../../engine/descriptors";

export const headingBlock: BlockDefinition = {
  type: "heading",
  name: "Heading",
  settings: [
    {
      id: "text",
      type: "text",
      label: "Text",
      default: "Heading",
    },
    {
      id: "level",
      type: "select",
      label: "Heading Level",
      default: "h2",
      options: [
        { label: "Heading 1", value: "h1" },
        { label: "Heading 2", value: "h2" },
        { label: "Heading 3", value: "h3" },
        { label: "Heading 4", value: "h4" },
      ],
    },
    {
      id: "alignment",
      type: "select",
      label: "Alignment",
      default: "left",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
  ],
};
