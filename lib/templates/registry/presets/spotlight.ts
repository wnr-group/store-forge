import { DOCUMENT_SCHEMA_VERSION, type TemplateDocument } from "../../document";

export const spotlightPreset: TemplateDocument = {
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  layout: "spotlight",
  sections: {
    hero: {
      type: "hero",
      settings: { variant: "spotlight" },
      blocks: {},
      block_order: [],
    },
    products: {
      type: "product-grid",
      settings: {},
      blocks: {},
      block_order: [],
    },
  },
  order: ["hero", "products"],
};
