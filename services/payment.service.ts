import "server-only";
import { getPaymentConfigApi, removePaymentConfigApi, savePaymentConfigApi, type PaymentConfigApi } from "@/lib/api/endpoints/payment-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";
import { paymentConfigSchema } from "@/lib/validations/payments";
import { parseInput } from "@/lib/validations/parse";

/**
 * Owner-only Razorpay credentials for the ACTIVE tenant, served by the StoreForge API (`/payments/razorpay`).
 *
 * The permission is checked BEFORE any API call: a non-Owner never reaches the network. Tenant scope is never taken from input;
 * it comes from `requireActiveTenant("payments:manage")`, and the API checks membership and role again. "Configured" means
 * saved, NOT verified with Razorpay. Nothing here returns the Key Secret, and nothing logs it.
 */
export const PAYMENTS_UNAVAILABLE_MESSAGE = "Payment settings are temporarily unavailable. Please contact support.";

export type PaymentConfig =
  | { configured: false }
  | { configured: true; keyIdMasked: string; mode: "test" | "live"; webhookSecretConfigured: boolean; updatedAt: Date; updatedByName: string | null };

const toConfig = (c: PaymentConfigApi): PaymentConfig =>
  c.configured
    ? { configured: true, keyIdMasked: c.keyIdMasked, mode: c.mode, webhookSecretConfigured: c.webhookSecretConfigured ?? false, updatedAt: new Date(c.updatedAt), updatedByName: c.updatedByName }
    : { configured: false };

/** The API answers 503 PAYMENTS_UNAVAILABLE when its encryption key is missing or unusable; show the exact Owner message. */
async function mapped<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof AppError && error.apiCode === "PAYMENTS_UNAVAILABLE") throw new AppError("UNKNOWN", PAYMENTS_UNAVAILABLE_MESSAGE);
    throw error;
  }
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const { tenant } = await requireActiveTenant("payments:manage");
  return toConfig(await mapped(() => getPaymentConfigApi(tenant.id)));
}

export async function savePaymentConfig(input: unknown): Promise<PaymentConfig> {
  const v = parseInput(paymentConfigSchema, input);
  const { tenant } = await requireActiveTenant("payments:manage");
  return toConfig(await mapped(() => savePaymentConfigApi(tenant.id, v)));
}

/** Idempotent: removing nothing succeeds. */
export async function removePaymentConfig(): Promise<void> {
  const { tenant } = await requireActiveTenant("payments:manage");
  await mapped(() => removePaymentConfigApi(tenant.id));
}
