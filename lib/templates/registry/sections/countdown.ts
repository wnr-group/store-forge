import type { SectionDefinition } from "../../engine/descriptors";

/**
 * A countdown to one fixed moment, the same for every visitor. There is intentionally no evergreen, per-visitor or reset option:
 * the settings below are the whole list (pinned by a test).
 */
export const countdownSection: SectionDefinition = {
  type: "countdown",
  name: "Countdown",
  description: "Counts down to a real end time, such as the end of a sale. It is the same for every visitor.",
  category: "Promotion",
  accepts: [],
  maxChildren: 0,
  settings: [
    { id: "heading", type: "text", label: "Heading", default: "Sale ends in", max: 80 },
    {
      id: "targetMode",
      type: "select",
      label: "Counts down to",
      default: "schedule-end",
      help: "The end of this section's own schedule (set under When to show), or a fixed date and time.",
      options: [
        { label: "End of this section's schedule", value: "schedule-end" },
        { label: "A fixed date and time", value: "fixed" },
      ],
    },
    {
      id: "fixedAt",
      type: "text",
      label: "Fixed end (ISO date and time)",
      default: "",
      placeholder: "2026-12-01T09:00:00Z",
      help: "An exact moment with its offset, for example 2026-12-01T09:00:00+05:30.",
      visibleIf: { setting: "targetMode", eq: "fixed" },
    },
    {
      id: "endBehavior",
      type: "select",
      label: "When it reaches zero",
      default: "hide",
      options: [
        { label: "Hide this section", value: "hide" },
        { label: "Show a message", value: "message" },
      ],
    },
    {
      id: "endMessage",
      type: "text",
      label: "Message at zero",
      default: "This offer has ended.",
      max: 160,
      visibleIf: { setting: "endBehavior", eq: "message" },
    },
  ],
};
