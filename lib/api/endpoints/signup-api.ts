import "server-only";
import { apiRequest } from "@/lib/api/client";

/**
 * `/signup/*` of the StoreForge API: a registered person with no organization yet buys a plan and then creates their store. These routes
 * need a signed-in person but NO organization id. Nothing here decides a price or marks anything paid: the API works the price out and
 * only counts a payment after it has checked Razorpay's signature AND asked Razorpay itself (or Razorpay's signed webhook said so).
 */
export type SignupState = "none" | "payment_required" | "store_required" | "provisioned";
export type SignupInterval = "monthly" | "yearly";

export type SignupStatusApi = {
  state: SignupState;
  signupId: string | null;
  planCode: string | null;
  planName: string | null;
  billingInterval: SignupInterval | null;
  currency: string | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  tenantId: string | null;
  /** Why the last payment attempt failed, when it did. */
  lastFailure: string | null;
};

export type SignupCheckoutApi = SignupStatusApi & {
  /** What Razorpay Checkout needs. Null when there is nothing to pay (a free plan, or the plan is already paid). */
  payment: { orderId: string; keyId: string } | null;
};

export type SignupPaymentVerifiedApi = { result: string; state: "store_required" | "provisioned" };
export type SignupStoreApi = { tenantId: string; storeSlug: string; publicId: string; created: boolean };

export const getSignupStatusApi = async () => (await apiRequest<SignupStatusApi>("/signup/status")).data;

export const startSignupCheckoutApi = async (input: { planCode: string; billingInterval: SignupInterval }) =>
  (await apiRequest<SignupCheckoutApi>("/signup/checkout", { method: "POST", json: input })).data;

export const verifySignupPaymentApi = async (input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
  (await apiRequest<SignupPaymentVerifiedApi>("/signup/verify-payment", { method: "POST", json: input })).data;

export const createSignupStoreApi = async (input: { storeName: string }) =>
  (await apiRequest<SignupStoreApi>("/signup/store", { method: "POST", json: input })).data;
