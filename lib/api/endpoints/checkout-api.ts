import "server-only";
import { apiRequest } from "@/lib/api/client";

/**
 * The shopper-facing checkout routes of the StoreForge API (`/public/stores/:slug/...`). All anonymous: the order token
 * (`X-Order-Token`) is the only credential, and it belongs to the shopper who placed the order. The API prices everything;
 * nothing here computes a price or a total.
 */

export type CheckoutLineApi = { productSlug: string; variantId: string | null; quantity: number; expectedUnitPriceMinor?: number };
export type PaymentMethodKind = "razorpay" | "cod";

export type AddressApi = { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country?: "IN" };

export type PaymentOptionsApi = { razorpayAvailable: boolean; codAvailable: boolean; codFeeMinor: number; codUnavailableReason: string | null };

export type ShippingOptionApi = {
  methodId: string;
  name: string;
  kind: "standard" | "express";
  pricingType: string;
  chargeMinor: number;
  free: boolean;
  estimatedDays: { min: number; max: number } | null;
  codAllowed: boolean;
  carrier: { code: string; name: string; serviceCode: string; serviceName: string; estimate: boolean } | null;
};

export type ShippingQuoteApi = {
  configured: boolean;
  deliverable: boolean;
  zone: { id: string; name: string; codAllowed: boolean } | null;
  options: ShippingOptionApi[];
  unavailable: { methodId: string; name: string; reason: string }[];
  reason: string | null;
};

export type TaxLineApi = {
  kind: "item" | "shipping" | "cod_fee";
  description: string;
  hsnCode: string | null;
  taxableMinor: number;
  rateBps: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
};

export type OrderTaxApi = {
  regime: "none" | "intra" | "inter";
  stateTaxKind: "sgst" | "utgst";
  inclusive: boolean;
  sellerGstin: string | null;
  placeOfSupplyStateCode: string | null;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
  lines: TaxLineApi[];
};

export type QuoteApi = {
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  taxInclusive: boolean;
  totalMinor: number;
  tax: OrderTaxApi;
};

export type PlacedOrderApi = {
  orderNumber: number;
  status: string;
  paymentStatus: string;
  paymentMethod: PaymentMethodKind;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  taxInclusive: boolean;
  totalMinor: number;
  tax: OrderTaxApi;
  shippingMethodName: string | null;
  shippingZoneName: string | null;
  shippingDays: { min: number; max: number } | null;
  items: { name: string; sku: string | null; /** The product handle (null if the product was deleted); lets analytics name it as when it was viewed. */ productSlug?: string | null; quantity: number; unitPriceMinor: number; totalMinor: number }[];
  reservationExpiresAt: string | null;
  accessToken: string | null;
  replayed: boolean;
};

export type PublicShipmentApi = {
  status: string;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  items: { name: string; quantity: number }[];
  events: { status: string; description: string; location: string | null; occurredAt: string | null }[];
};

export type PublicOrderApi = PlacedOrderApi & {
  shipments: PublicShipmentApi[];
  placedAt: string;
  fulfillmentStatus: string;
  shippingAddress: { fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; country: string };
};

export type RazorpaySessionApi = {
  keyId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: string;
  orderNumber: number;
  customer: { name: string; email: string; contact: string };
};

const base = (slug: string) => `/public/stores/${encodeURIComponent(slug)}`;
const tokenHeader = (token: string) => ({ "x-order-token": token });

export const getPaymentOptionsApi = async (slug: string, subtotalMinor: number) =>
  (await apiRequest<PaymentOptionsApi>(`${base(slug)}/payment-methods`, { anonymous: true, query: { subtotalMinor } })).data;

export const getShippingOptionsApi = async (slug: string, input: { address: { state: string; city?: string; postalCode: string }; lines: CheckoutLineApi[]; paymentMethod?: PaymentMethodKind }) =>
  (await apiRequest<ShippingQuoteApi>(`${base(slug)}/shipping/options`, { method: "POST", json: input, anonymous: true, timeoutMs: 30_000 })).data;

export const getQuoteApi = async (
  slug: string,
  input: { address: { state: string; city?: string; postalCode: string }; lines: CheckoutLineApi[]; paymentMethod?: PaymentMethodKind; shippingMethodId?: string },
) => (await apiRequest<QuoteApi>(`${base(slug)}/checkout/quote`, { method: "POST", json: input, anonymous: true, timeoutMs: 30_000 })).data;

export type PlaceOrderInput = {
  lines: CheckoutLineApi[];
  customer: { fullName: string; email: string; phone: string };
  shippingAddress: AddressApi;
  billingSameAsShipping: boolean;
  billingAddress?: AddressApi;
  paymentMethod: PaymentMethodKind;
  shippingMethodId?: string;
};

export const placeOrderApi = async (slug: string, input: PlaceOrderInput, idempotencyKey: string) =>
  (await apiRequest<PlacedOrderApi>(`${base(slug)}/orders`, { method: "POST", json: input, anonymous: true, headers: { "idempotency-key": idempotencyKey }, timeoutMs: 30_000 })).data;

export const getPublicOrderApi = async (slug: string, orderNumber: number, token: string) =>
  (await apiRequest<PublicOrderApi>(`${base(slug)}/orders/${orderNumber}`, { anonymous: true, headers: tokenHeader(token) })).data;

export const cancelPublicOrderApi = async (slug: string, orderNumber: number, token: string) =>
  (await apiRequest<PublicOrderApi>(`${base(slug)}/orders/${orderNumber}/cancel`, { method: "POST", anonymous: true, headers: tokenHeader(token) })).data;

export const startRazorpayApi = async (slug: string, orderNumber: number, token: string) =>
  (await apiRequest<RazorpaySessionApi>(`${base(slug)}/orders/${orderNumber}/payments/razorpay`, { method: "POST", anonymous: true, headers: tokenHeader(token), timeoutMs: 30_000 })).data;

export type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

export const verifyRazorpayApi = async (slug: string, orderNumber: number, token: string, body: RazorpaySuccess) =>
  (await apiRequest<PublicOrderApi>(`${base(slug)}/orders/${orderNumber}/payments/razorpay/verify`, { method: "POST", json: body, anonymous: true, headers: tokenHeader(token), timeoutMs: 30_000 })).data;

export const reportRazorpayFailureApi = async (slug: string, orderNumber: number, token: string, body: { razorpay_order_id: string; razorpay_payment_id: string }) =>
  (await apiRequest<PublicOrderApi>(`${base(slug)}/orders/${orderNumber}/payments/razorpay/failed`, { method: "POST", json: body, anonymous: true, headers: tokenHeader(token), timeoutMs: 30_000 })).data;
