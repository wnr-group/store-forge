import { z } from "zod";
import { STORE_STATUSES } from "@/lib/db/schema";
import { passwordField } from "./auth";
import { storeSettingsSchema } from "./catalog";
import { emailField, optionalPhone, optionalText, requiredText } from "./fields";

/**
 * Platform Admin edits. Everything is re-validated on the server: the browser never supplies an organization's slug,
 * status, an owner id from another organization, or a role.
 */

/** Organization: name, contact phone and address. The slug and status are not editable here. */
export const updateCompanySchema = z.object({
  companyName: requiredText("Organization name", 80, 2),
  contactPhone: optionalPhone,
  address: optionalText("Address", 300),
});
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;

/** Store: the merchant settings rules minus the address (slug) and logo, which an admin does not edit. */
export const updateStoreSchema = storeSettingsSchema.omit({ slug: true, logoPath: true });
export type UpdateStoreInput = z.input<typeof updateStoreSchema>;

/** Store status is independent of the organization's status. */
export const storeStatusSchema = z.enum(STORE_STATUSES, { error: "Choose a store status." });

export const memberStatusSchema = z.enum(["active", "disabled"], { error: "Choose a status." });

/** What happens to the current Owner: stays on as a team member, or is disabled (for a lost or compromised account). */
const previousOwner = z.enum(["keep", "disable"], { error: "Choose what happens to the current owner." }).default("keep");

/** Hand ownership to an existing, active team member. */
export const transferOwnershipSchema = z.object({ userId: z.uuid({ error: "Choose a team member." }), previousOwner });
export type TransferOwnershipInput = z.input<typeof transferOwnershipSchema>;

/** Owner recovery: a brand-new owner account (name, e-mail and an initial password to share securely). */
export const recoverOwnerSchema = z.object({
  ownerName: requiredText("Owner name", 120, 2),
  ownerEmail: emailField("Owner email"),
  ownerPassword: passwordField,
  previousOwner,
});
export type RecoverOwnerInput = z.input<typeof recoverOwnerSchema>;
