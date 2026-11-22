import type { SectionDefinition } from "../../engine/descriptors";
import { cardPartSettings } from "../../card-parts";

export const featuredCollectionSection: SectionDefinition = {
  type: "featured-collection",
  name: "Featured Collection",
  category: "Collections",
  settings: [
    {
      id: "collectionId",
      type: "text",
      label: "Collection Identifier",
      default: "",
    },
    {
      id: "eyebrow",
      type: "text",
      label: "Small label above the heading",
      default: "",
      help: "Shown by themes that support it",
    },
    {
      id: "title",
      type: "text",
      label: "Heading",
      default: "Featured Collection",
    },
    {
      id: "tone",
      type: "select",
      label: "Section tone",
      default: "light",
      help: "Dark puts the products on the theme's primary colour. Shown by themes that support it",
      options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ],
    },
    {
      id: "productsToShow",
      type: "number",
      label: "Products to Show",
      default: 4,
      min: 2,
      max: 24,
    },
    {
      id: "columns",
      type: "range",
      label: "Columns on Desktop",
      default: 4,
      min: 2,
      max: 6,
    },
    {
      id: "showViewAll",
      type: "toggle",
      label: "Show View All Link",
      default: true,
    },
    ...cardPartSettings,
  ],
};
