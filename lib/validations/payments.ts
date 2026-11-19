import { z } from "zod";

/**
 * Razorpay credentials. These rules mirror the API's DTO EXACTLY (the API is authoritative); neither value is trimmed or
 * changed, so padding is rejected rather than silently stored.
 *
 * The secret rule is based on ONE observed disposable test-mode credential. It is not an officially guaranteed Razorpay format.
 */
export const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{8,}$/;
export const KEY_SECRET_PATTERN = /^[A-Za-z0-9]{16,128}$/;

export const KEY_ID_MESSAGE = "Enter a valid Razorpay Key ID, like rzp_test_ or rzp_live_ followed by at least 8 letters or numbers.";
export const KEY_SECRET_MESSAGE = "Enter a valid Razorpay Key Secret: 16 to 128 letters and numbers, with no spaces or symbols.";

export const paymentConfigSchema = z.strictObject({
  keyId: z.string({ error: "Enter your Razorpay Key ID." }).regex(KEY_ID_PATTERN, KEY_ID_MESSAGE),
  keySecret: z.string({ error: "Enter your Razorpay Key Secret." }).regex(KEY_SECRET_PATTERN, KEY_SECRET_MESSAGE),
});

export type PaymentConfigInput = z.infer<typeof paymentConfigSchema>;
