import type { SectionDefinition } from "../../engine/descriptors";

export const collectionBannerSection: SectionDefinition = {
  type: "collection-banner",
  name: "Collection Banner",
  category: "Collections",
  accepts: ["heading", "text"],
  maxChildren: 5,
  settings: [
    {
      id: "showCollectionDescription",
      type: "toggle",
      label: "Show Collection Description",
      default: true,
    },
    {
      id: "showCollectionImage",
      type: "toggle",
      label: "Show Collection Image",
      default: true,
    },
  ],
};
