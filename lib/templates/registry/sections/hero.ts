import type { SectionDefinition } from "../../engine/descriptors";

export const heroSection: SectionDefinition = {
  type: "hero",
  name: "Hero Banner",
  category: "Banners",
  accepts: ["heading", "text", "button", "hero-slide"],
  maxChildren: 10,
  settings: [
    {
      id: "variant",
      type: "select",
      label: "Variant",
      default: "classic",
      options: [
        { label: "Banner (full-width picture)", value: "banner" },
        { label: "Split (text and picture)", value: "split" },
        { label: "Spotlight (centred)", value: "spotlight" },
        { label: "Classic", value: "classic" },
      ],
    },
    {
      id: "alignment",
      type: "select",
      label: "Text alignment",
      default: "left",
      options: [
        { label: "Left", value: "left" },
        { label: "Centre", value: "center" },
      ],
    },
    {
      id: "height",
      type: "select",
      label: "Height",
      default: "medium",
      options: [
        { label: "Small", value: "small" },
        { label: "Medium", value: "medium" },
        { label: "Large", value: "large" },
        { label: "Full screen (fills the first screen)", value: "fullscreen" },
      ],
    },
    {
      id: "textTone",
      type: "select",
      label: "Text colour on picture",
      default: "light",
      options: [
        { label: "Light (for dark pictures)", value: "light" },
        { label: "Dark (for light pictures)", value: "dark" },
      ],
    },
    {
      id: "overlay",
      type: "range",
      label: "Picture tint (%)",
      default: 35,
      min: 0,
      max: 80,
      help: "Darkens the picture behind light text, or lightens it behind dark text",
    },
    {
      id: "eyebrow",
      type: "text",
      label: "Small label above the heading",
      default: "",
      help: "Shown by themes that support it. Empty shows the store name.",
    },
    {
      id: "heading",
      type: "text",
      label: "Heading",
      default: "",
      help: "Main heading displayed in the hero banner",
    },
    {
      id: "subheading",
      type: "textarea",
      label: "Subheading",
      default: "",
      help: "Supporting text under the heading",
    },
    {
      id: "accentColor",
      type: "color",
      label: "Accent Color",
      default: "#1a5aaa",
    },
    {
      id: "image",
      type: "image",
      label: "Hero Image",
      default: null,
      help: "Upload your own picture. Wide pictures at least 1600 px across work best.",
    },
  ],
};
