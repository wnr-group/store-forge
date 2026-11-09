import { z } from "zod";
import { AUDIT_ACTIONS } from "@/lib/admin/audit";

/** Rows-per-page choices shared by every Platform Admin list. */
export const ADMIN_PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_ADMIN_PAGE_SIZE = 20;

const page = z.coerce.number().int().min(1).max(100_000).catch(1);
const pageSize = z.coerce
  .number()
  .refine((n): n is (typeof ADMIN_PAGE_SIZES)[number] => (ADMIN_PAGE_SIZES as readonly number[]).includes(n))
  .catch(DEFAULT_ADMIN_PAGE_SIZE);
const text = (max: number) => z.string().trim().max(max).catch("").default("");
/** A calendar date from a date input. Anything else counts as "no date". */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)))
  .catch("")
  .default("");

/** Organizations list. Invalid URL values fall back to the defaults instead of erroring. */
export const orgListQuerySchema = z.object({
  q: text(80),
  status: z.enum(["all", "active", "suspended"]).catch("all").default("all"),
  sort: z.enum(["created", "name"]).catch("created").default("created"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export type OrgListQuery = z.output<typeof orgListQuerySchema>;

/** Activity & Audit Logs. `org` narrows to one organization (a link from its page); `q` searches the organization name. */
export const auditListQuerySchema = z.object({
  action: z.enum([...AUDIT_ACTIONS, "all"]).catch("all").default("all"),
  admin: z.union([z.uuid(), z.literal("all")]).catch("all").default("all"),
  org: z.union([z.uuid(), z.literal("")]).catch("").default(""),
  q: text(80),
  from: dateOnly,
  to: dateOnly,
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export type AuditListQuery = z.output<typeof auditListQuerySchema>;
