import { z } from "zod";

/** Addresses that already mean something on a store's own address. Keep in sync with the API and the database. */
export const RESERVED_PAGE_SLUGS = ["products", "collections", "catalog", "search", "cart", "checkout", "login", "dashboard", "admin", "api", "pages", "s", "no-workspace", "account"] as const;

export const pageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "Use lowercase letters, numbers and hyphens only.")
  .refine((s) => !(RESERVED_PAGE_SLUGS as readonly string[]).includes(s), "That address is used by the store itself. Pick another.");

export const pageInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120, "Use 120 characters or fewer."),
  // Blank means "make it from the title".
  slug: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), pageSlugSchema.optional()),
  body: z.string().max(20000, "Use 20,000 characters or fewer.").default(""),
  status: z.enum(["draft", "published"]).default("draft"),
});

export type PageInput = z.input<typeof pageInputSchema>;
