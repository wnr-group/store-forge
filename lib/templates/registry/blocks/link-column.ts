import type { BlockDefinition } from "../../engine/descriptors";

export const linkColumnBlock: BlockDefinition = {
  type: "link-column",
  name: "Link Column",
  accepts: ["link"],
  maxChildren: 20,
  settings: [
    {
      id: "title",
      type: "text",
      label: "Column Title",
      default: "Quick Links",
    },
  ],
};
