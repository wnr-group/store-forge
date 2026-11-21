import type { SectionDefinition } from "../../engine/descriptors";

export const collapsibleContentSection: SectionDefinition = {
  type: "collapsible-content",
  name: "Collapsible Content",
  category: "Content",
  accepts: ["collapsible-item"],
  maxChildren: 20,
  settings: [
    {
      id: "heading",
      type: "text",
      label: "Section Heading",
      default: "Frequently Asked Questions",
    },
    {
      id: "subheading",
      type: "textarea",
      label: "Subheading",
      default: "Find answers to common questions about our products, shipping, and returns.",
    },
    {
      id: "eyebrow",
      type: "text",
      label: "Small label above the heading",
      default: "",
      help: "Shown by themes that support it",
    },
    {
      id: "ctaLabel",
      type: "text",
      label: "Button label",
      default: "",
      help: "Leave empty for no button. Shown by themes that support it",
    },
    {
      id: "ctaLink",
      type: "url",
      label: "Button link",
      default: "/contact",
    },
    {
      id: "openFirstItem",
      type: "toggle",
      label: "Keep first item open",
      default: true,
    },
  ],
};
