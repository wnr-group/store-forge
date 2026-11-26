import { z } from "zod";

/** The plan being bought: a code from the public pricing page and a billing period. The API refuses anything that is not a published plan. */
export const checkoutSchema = z.object({
  planCode: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/, "Choose a plan"),
  billingInterval: z.enum(["monthly", "yearly"], { error: "Choose monthly or yearly billing" }),
});

/** The store name is all a customer types: the address is made from it by the API, so there is no subdomain field. */
export const storeNameSchema = z.object({
  storeName: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use at most 80 characters"),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type StoreNameInput = z.input<typeof storeNameSchema>;
