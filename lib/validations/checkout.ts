import { z } from "zod";
import { INDIAN_STATE_NAMES } from "@/lib/checkout/states";

/**
 * Checkout field rules. They mirror the API's DTOs so a shopper sees the problem next to the field before anything is
 * sent; the API checks every rule again and stays authoritative.
 */
export const PHONE_PATTERN = /^(?:\+?91[\s-]?)?[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

const text = (label: string, max: number) => z.string({ error: `Enter ${label}.` }).trim().min(1, `Enter ${label}.`).max(max, `${label[0]!.toUpperCase()}${label.slice(1)} is too long.`);

export const addressSchema = z.object({
  fullName: text("the full name", 120),
  phone: z.string({ error: "Enter a mobile number." }).trim().regex(PHONE_PATTERN, "Enter a valid 10-digit Indian mobile number."),
  line1: text("the address", 200),
  line2: z.string().trim().max(200, "Address line 2 is too long.").optional(),
  city: text("the city", 100),
  state: z.string({ error: "Choose a state." }).refine((s) => (INDIAN_STATE_NAMES as readonly string[]).includes(s), "Choose a state or union territory."),
  postalCode: z.string({ error: "Enter a PIN code." }).trim().regex(PINCODE_PATTERN, "Enter a valid 6-digit PIN code."),
});

export const customerSchema = z.object({
  fullName: text("your name", 120),
  email: z.string({ error: "Enter your email." }).trim().max(254).email("Enter a valid email address."),
  phone: z.string({ error: "Enter a mobile number." }).trim().regex(PHONE_PATTERN, "Enter a valid 10-digit Indian mobile number."),
});

export const lineSchema = z.object({
  productSlug: z.string().min(1).max(80),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(100),
  expectedUnitPriceMinor: z.number().int().min(0).optional(),
});

/** A discount code as the shopper types it: capitals, letters, digits, hyphen and underscore. The API decides whether it works. */
export const discountCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/, "Enter a valid discount code.");

/** The random id the browser keeps for its cart (see lib/checkout/cart-key.ts). */
export const cartKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

export const storeSlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);
export const methodSchema = z.enum(["razorpay", "cod"]);

export const placeOrderSchema = z.object({
  storeSlug: storeSlugSchema,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  lines: z.array(lineSchema).min(1, "Your bag is empty.").max(50),
  customer: customerSchema,
  shippingAddress: addressSchema,
  billingSameAsShipping: z.boolean(),
  billingAddress: addressSchema.optional(),
  paymentMethod: methodSchema,
  shippingMethodId: z.string().uuid().optional(),
  discountCode: discountCodeSchema.optional(),
  cartKey: cartKeySchema.optional(),
});

export type PlaceOrderFormInput = z.input<typeof placeOrderSchema>;
