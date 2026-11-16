import type { BlockDefinition } from "../../engine/descriptors";

/**
 * One slide of a hero slider. A picture slide shows a heading, text and a button over the picture; a video slide plays the
 * video with no text and no slide controls, then moves on. With a single slide the hero does not slide at all.
 */
export const heroSlideBlock: BlockDefinition = {
  type: "hero-slide",
  name: "Hero slide",
  settings: [
    {
      id: "mediaType",
      type: "select",
      label: "Slide type",
      default: "image",
      options: [
        { label: "Picture with text", value: "image" },
        { label: "Video", value: "video" },
      ],
    },
    { id: "image", type: "image", label: "Picture", default: null, visibleIf: { setting: "mediaType", eq: "image" }, help: "Wide pictures at least 1600 px across work best." },
    { id: "video", type: "image", label: "Video", default: null, visibleIf: { setting: "mediaType", eq: "video" } },
    { id: "heading", type: "text", label: "Heading", default: "", visibleIf: { setting: "mediaType", eq: "image" } },
    { id: "subheading", type: "textarea", label: "Text", default: "", visibleIf: { setting: "mediaType", eq: "image" } },
    { id: "buttonLabel", type: "text", label: "Button label", default: "", visibleIf: { setting: "mediaType", eq: "image" }, help: "Leave empty for no button." },
    { id: "link", type: "url", label: "Button link", default: "/collections", visibleIf: { setting: "mediaType", eq: "image" } },
  ],
};
