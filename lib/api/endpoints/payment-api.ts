import "server-only";
import { apiRequest } from "@/lib/api/client";

/**
 * `/payments/razorpay` of the StoreForge API (Owner only). The API owns validation, encryption and authorization; this file
 * only forwards. The organization id is ALWAYS passed, so `X-Organization-Id` is sent on every call (the API refuses these
 * routes without it). The Key Secret goes out in `savePaymentConfigApi` and is never returned by any route.
 */
export type PaymentConfigApi =
  | { configured: false }
  | {
      configured: true;
      keyIdMasked: string;
      mode: "test" | "live";
      /** True when a webhook secret is saved. The secret itself is never returned. */
      webhookSecretConfigured: boolean;
      /** Whether shoppers can pay with Razorpay at checkout. Turning it on needs a successful connection check. */
      enabled?: boolean;
      verificationStatus?: "unverified" | "verified" | "failed";
      verifiedAt?: string | null;
      verificationError?: string | null;
      /** The address to give Razorpay under Settings > Webhooks, relative to the API. */
      webhookPath?: string;
      /** ISO string. */
      updatedAt: string;
      /** The person who last saved it, or null when they are no longer on the team. */
      updatedByName: string | null;
    };

export const getPaymentConfigApi = async (organizationId: string) =>
  (await apiRequest<PaymentConfigApi>("/payments/razorpay", { organizationId })).data;

export const savePaymentConfigApi = async (organizationId: string, input: { keyId: string; keySecret: string; webhookSecret?: string }) =>
  (await apiRequest<PaymentConfigApi>("/payments/razorpay", { method: "PUT", json: input, organizationId })).data;

export const removePaymentConfigApi = async (organizationId: string) => {
  await apiRequest<PaymentConfigApi>("/payments/razorpay", { method: "DELETE", organizationId });
};

/** Calls Razorpay with the saved keys (creates nothing) and saves the result. A failed check also switches Razorpay off. */
export const verifyPaymentConfigApi = async (organizationId: string) =>
  (await apiRequest<PaymentConfigApi>("/payments/razorpay/verify", { method: "POST", organizationId, timeoutMs: 30_000 })).data;

export const setPaymentEnabledApi = async (organizationId: string, enabled: boolean) =>
  (await apiRequest<PaymentConfigApi>("/payments/razorpay/enabled", { method: "PUT", json: { enabled }, organizationId })).data;
