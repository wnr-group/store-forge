import type { SectionDefinition } from "../../engine/descriptors";

/** A row of store-owner badges (see lib/templates/trust-badges.ts for what a badge may and may not say). */
export const trustBadgesSection: SectionDefinition = {
  type: "trust-badges",
  name: "Trust Badges",
  description: "A row of short statements from you, such as free shipping or easy returns.",
  category: "Content",
  accepts: ["trust-badge"],
  maxChildren: 8,
  settings: [
    { id: "heading", type: "text", label: "Heading", default: "", max: 80 },
    {
      id: "alignment",
      type: "select",
      label: "Alignment",
      default: "center",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
  ],
  defaultBlocks: [
    { type: "trust-badge", settings: { kind: "preset", preset: "free-shipping" } },
    { type: "trust-badge", settings: { kind: "preset", preset: "easy-returns" } },
  ],
};
