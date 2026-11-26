import "server-only";
import {
  createSignupStoreApi,
  getSignupStatusApi,
  startSignupCheckoutApi,
  verifySignupPaymentApi,
  type SignupInterval,
} from "@/lib/api/endpoints/signup-api";
import { requireUser } from "@/lib/auth/session";

/**
 * Self-service onboarding: after the account exists, buy a plan and create the store. The person is always the signed-in one (their
 * session decides it, never an argument), the API works out the price, and a payment only counts once the API has confirmed it with
 * Razorpay. Nothing here touches an organization: the person has none until the store step succeeds.
 */

export async function getSignupStatus() {
  await requireUser();
  return getSignupStatusApi();
}

/** Starts (or resumes) paying for a plan. Calling it again after a failed payment returns the same Razorpay order. */
export async function startCheckout(input: { planCode: string; billingInterval: SignupInterval }) {
  await requireUser();
  return startSignupCheckoutApi(input);
}

/** Hands Razorpay's three success values to the API, which checks the signature and asks Razorpay itself before it marks anything paid. */
export async function verifyCheckout(input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  await requireUser();
  return verifySignupPaymentApi(input);
}

/** Creates the store (and, through it, the organization with this person as Owner). Only works once the plan is paid. */
export async function createStore(input: { storeName: string }) {
  await requireUser();
  return createSignupStoreApi(input);
}
