import type { BlockDefinition } from "../../engine/descriptors";

export const socialLinkBlock: BlockDefinition = {
  type: "social-link",
  name: "Social Link",
  settings: [
    {
      id: "network",
      type: "select",
      label: "Social Network",
      default: "instagram",
      options: [
        { label: "Instagram", value: "instagram" },
        { label: "Facebook", value: "facebook" },
        { label: "X (Twitter)", value: "x" },
        { label: "Twitter", value: "twitter" },
        { label: "Pinterest", value: "pinterest" },
        { label: "YouTube", value: "youtube" },
        { label: "LinkedIn", value: "linkedin" },
      ],
    },
    {
      id: "url",
      type: "url",
      label: "Profile URL",
      default: "https://instagram.com",
    },
  ],
};
