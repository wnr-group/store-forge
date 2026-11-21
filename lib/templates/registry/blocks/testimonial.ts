import type { BlockDefinition } from "../../engine/descriptors";

export const testimonialBlock: BlockDefinition = {
  type: "testimonial",
  name: "Testimonial",
  settings: [
    {
      id: "quote",
      type: "textarea",
      label: "Customer Quote",
      default: "Store Forge has completely transformed how we sell our products online.",
    },
    {
      id: "author",
      type: "text",
      label: "Author Name",
      default: "Jane Doe",
    },
    {
      id: "role",
      type: "text",
      label: "Author Role",
      default: "Verified Customer",
    },
    {
      id: "rating",
      type: "range",
      label: "Star rating",
      default: 5,
      min: 1,
      max: 5,
      help: "Shown by themes that display stars",
    },
    {
      id: "company",
      type: "text",
      label: "Company / Location",
      default: "",
    },
    {
      id: "avatar",
      type: "image",
      label: "Author Avatar",
      default: null,
    },
  ],
};
