import { DOCUMENT_SCHEMA_VERSION, type TemplateDocument } from "../../document";

export const groupFooterPreset: TemplateDocument = {
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  layout: "classic",
  sections: {
    footer: {
      type: "footer",
      settings: {
        backgroundColor: "#f8fafc",
        textColor: "#0f172a",
        copyrightText: "",
        showPaymentIcons: false,
        showSocial: true,
      },
      blocks: {},
      block_order: [],
    },
  },
  order: ["footer"],
};
