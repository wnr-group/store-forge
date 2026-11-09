import { DOCUMENT_SCHEMA_VERSION, type TemplateDocument } from "../../document";

export const classicPreset: TemplateDocument = {
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  layout: "classic",
  sections: {
    hero: {
      type: "hero",
      settings: { variant: "classic" },
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
