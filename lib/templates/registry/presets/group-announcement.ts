import { DOCUMENT_SCHEMA_VERSION, type TemplateDocument } from "../../document";

export const groupAnnouncementPreset: TemplateDocument = {
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  layout: "classic",
  sections: {
    announcement: {
      type: "announcement-bar",
      settings: {
        text: "Special announcement: free delivery on all orders this week!",
        link: "",
        backgroundColor: "#0f172a",
        textColor: "#ffffff",
        showSocial: false,
        alignment: "center",
      },
      blocks: {},
      block_order: [],
    },
  },
  order: ["announcement"],
};
