"use server";

import { z } from "zod";
import { run } from "@/lib/actions/run";
import {
  cancelPublicOrderApi,
  getPaymentOptionsApi,
  getPublicOrderApi,
  getQuoteApi,
  getShippingOptionsApi,
  placeOrderApi,
  reportRazorpayFailureApi,
  startRazorpayApi,
  verifyRazorpayApi,
} from "@/lib/api/endpoints/checkout-api";
import { AppError } from "@/lib/errors";
import { addressSchema, lineSchema, methodSchema, placeOrderSchema, storeSlugSchema } from "@/lib/validations/checkout";
import { parseInput } from "@/lib/validations/parse";

/**
 * Server actions behind the storefront checkout. Every one is anonymous and forwards to the store's PUBLIC API routes under
 * the one store slug it is given: nothing here reads a session, prices anything or decides whether a payment succeeded. The
 * order token only ever travels shopper -> here -> API, and is never logged (`run` logs the operation name, never input).
 */

const quoteAddress = z.object({ state: addressSchema.shape.state, city: z.string().trim().max(100).optional(), postalCode: addressSchema.shape.postalCode });
const cartInput = z.object({ storeSlug: storeSlugSchema, lines: z.array(lineSchema).min(1).max(50), address: quoteAddress, paymentMethod: methodSchema.optional() });

export async function paymentOptionsAction(input: unknown) {
  return run(async () => {
    const v = parseInput(z.object({ storeSlug: storeSlugSchema, subtotalMinor: z.number().int().min(0) }), input);
    return getPaymentOptionsApi(v.storeSlug, v.subtotalMinor);
  });
}

export async function shippingOptionsAction(input: unknown) {
  return run(async () => {
    const v = parseInput(cartInput, input);
    return getShippingOptionsApi(v.storeSlug, { address: v.address, lines: v.lines, paymentMethod: v.paymentMethod });
  });
}

export async function quoteAction(input: unknown) {
  return run(async () => {
    const v = parseInput(cartInput.extend({ shippingMethodId: z.string().uuid().optional() }), input);
    return getQuoteApi(v.storeSlug, { address: v.address, lines: v.lines, paymentMethod: v.paymentMethod, shippingMethodId: v.shippingMethodId });
  });
}

export async function placeOrderAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(placeOrderSchema, input);
      if (!v.billingSameAsShipping && !v.billingAddress) {
        throw new AppError("VALIDATION", "Enter the billing address.", { billingAddress: "Enter the billing address." });
      }
      const { storeSlug, idempotencyKey, ...body } = v;
      return placeOrderApi(storeSlug, { ...body, billingAddress: v.billingSameAsShipping ? undefined : v.billingAddress }, idempotencyKey);
    },
    { operation: "checkout.place" },
  );
}

const orderRef = z.object({ storeSlug: storeSlugSchema, orderNumber: z.number().int().min(1), token: z.string().min(16).max(200) });

export async function getOrderAction(input: unknown) {
  return run(async () => {
    const v = parseInput(orderRef, input);
    return getPublicOrderApi(v.storeSlug, v.orderNumber, v.token);
  });
}

export async function cancelOrderAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(orderRef, input);
      return cancelPublicOrderApi(v.storeSlug, v.orderNumber, v.token);
    },
    { operation: "checkout.cancel" },
  );
}

export async function startRazorpayAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(orderRef, input);
      return startRazorpayApi(v.storeSlug, v.orderNumber, v.token);
    },
    { operation: "checkout.razorpay.start" },
  );
}

const rzpId = z.string().regex(/^[A-Za-z0-9_]{8,64}$/);

export async function verifyRazorpayAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(orderRef.extend({ razorpay_order_id: rzpId, razorpay_payment_id: rzpId, razorpay_signature: z.string().regex(/^[0-9a-fA-F]{64}$/) }), input);
      return verifyRazorpayApi(v.storeSlug, v.orderNumber, v.token, { razorpay_order_id: v.razorpay_order_id, razorpay_payment_id: v.razorpay_payment_id, razorpay_signature: v.razorpay_signature });
    },
    { operation: "checkout.razorpay.verify" },
  );
}

export async function reportRazorpayFailureAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(orderRef.extend({ razorpay_order_id: rzpId, razorpay_payment_id: rzpId }), input);
      return reportRazorpayFailureApi(v.storeSlug, v.orderNumber, v.token, { razorpay_order_id: v.razorpay_order_id, razorpay_payment_id: v.razorpay_payment_id });
    },
    { operation: "checkout.razorpay.failed" },
  );
}
