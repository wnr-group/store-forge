import { z } from "zod";
import { TEMPLATE_KEYS } from "@/lib/templates/registry";

/** Browser-supplied values are validated again on the server; the database CHECKs repeat the same rules. */

export const ACCENT_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const HERO_HEADING_MAX = 80;
export const HERO_SUBHEADING_MAX = 200;

/** Blank, whitespace-only and missing values all mean "not configured" (NULL). */
const toNull = (v: string | null | undefined) => (v ? v : null);

const optionalLine = (label: string, max: number) =>
  z
    .string()
    .trim()
    .nullish()
    .transform(toNull)
    .pipe(z.string().max(max, `${label} must be at most ${max} characters.`).nullable());

export const templateSettingsSchema = z.object({
  templateKey: z.enum(TEMPLATE_KEYS, { error: "Choose a template from the list." }),
  accentColor: z
    .string()
    .trim()
    .nullish()
    .transform(toNull)
    .pipe(
      z
        .string()
        .regex(ACCENT_COLOR_PATTERN, "Use a six-digit hex color such as #1a2b3c.")
        .transform((v) => v.toLowerCase())
        .nullable(),
    ),
  heroHeading: optionalLine("Hero heading", HERO_HEADING_MAX),
  heroSubheading: optionalLine("Hero subheading", HERO_SUBHEADING_MAX),
  heroImagePath: z.string().trim().max(300).nullish().transform(toNull),
});

export type TemplateSettingsInput = z.input<typeof templateSettingsSchema>;
export type TemplateSettingsValues = z.output<typeof templateSettingsSchema>;
