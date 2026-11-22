import type { BlockDefinition } from "../../engine/descriptors";
import { BADGE_ICONS, PRESET_BADGES } from "../../trust-badges";

const titleCase = (s: string): string => s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * One trust badge. The uploaded-mark fields (`markAssetId`, `markPath`) are filled by the upload dialog, not typed: they hold the
 * media asset id and its path only. Wording and link rules live in lib/templates/trust-badges.ts.
 */
export const trustBadgeBlock: BlockDefinition = {
  type: "trust-badge",
  name: "Trust Badge",
  settings: [
    {
      id: "kind",
      type: "select",
      label: "Badge type",
      default: "preset",
      options: [
        { label: "Ready-made badge", value: "preset" },
        { label: "Text with an icon", value: "text" },
        { label: "My own image", value: "upload" },
      ],
    },
    {
      id: "preset",
      type: "select",
      label: "Badge",
      default: "free-shipping",
      options: PRESET_BADGES.map((p) => ({ label: titleCase(p), value: p })),
      visibleIf: { setting: "kind", eq: "preset" },
    },
    { id: "text", type: "text", label: "Badge text", default: "", max: 40, visibleIf: { setting: "kind", eq: "text" } },
    {
      id: "icon",
      type: "select",
      label: "Icon",
      default: "star",
      options: BADGE_ICONS.map((i) => ({ label: titleCase(i), value: i })),
      visibleIf: { setting: "kind", eq: "text" },
    },
    { id: "markAssetId", type: "text", label: "Image (asset id)", default: "", max: 64, visibleIf: { setting: "kind", eq: "upload" } },
    { id: "markPath", type: "text", label: "Image path", default: "", max: 300, visibleIf: { setting: "kind", eq: "upload" } },
    { id: "markAlt", type: "text", label: "Image description (required)", default: "", max: 125, visibleIf: { setting: "kind", eq: "upload" } },
    { id: "link", type: "url", label: "Link (optional)", default: "", help: "A page on your store, starting with /, or an https:// address." },
  ],
};
