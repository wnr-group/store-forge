import "server-only";
import { apiRequest } from "@/lib/api/client";
import type { AddressApi, PublicOrderApi } from "@/lib/api/endpoints/checkout-api";

/**
 * The shopper account routes of the StoreForge API (`/public/stores/:slug/account/...`). The shopper's session token travels in
 * `X-Customer-Session` and is only ever read from the HttpOnly cookie on the server (see lib/customer/session.ts). It is a
 * different credential from the owner/staff/admin session: the API never accepts one in place of the other.
 */

export type CustomerProfileApi = { fullName: string; email: string; phone: string | null };
export type CustomerSessionApi = { sessionToken: string; expiresAt: string; profile: CustomerProfileApi };
export type CustomerAddressApi = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; isDefault: boolean };
export type AddressInput = AddressApi & { label?: string; isDefault?: boolean };

export type TimelineEntryApi = { status: string; at: string };
export type AccountOrderApi = PublicOrderApi & { timeline: TimelineEntryApi[] };
export type AccountOrderSummaryApi = { orderNumber: number; status: string; paymentStatus: string; paymentMethod: string; currency: string; totalMinor: number; placedAt: string; itemCount: number; firstItemName: string | null };

const base = (slug: string) => `/public/stores/${encodeURIComponent(slug)}/account`;
const session = (token: string) => ({ "x-customer-session": token });

export const registerCustomerApi = async (slug: string, input: { fullName: string; email: string; phone?: string; password: string }) =>
  (await apiRequest<CustomerSessionApi>(`${base(slug)}/register`, { method: "POST", json: input, anonymous: true })).data;

export const loginCustomerApi = async (slug: string, input: { email: string; password: string }) =>
  (await apiRequest<CustomerSessionApi>(`${base(slug)}/login`, { method: "POST", json: input, anonymous: true })).data;

export const logoutCustomerApi = async (slug: string, token: string) => {
  await apiRequest<null>(`${base(slug)}/logout`, { method: "POST", anonymous: true, headers: session(token) });
};

export const getCustomerProfileApi = async (slug: string, token: string) => (await apiRequest<CustomerProfileApi>(`${base(slug)}/me`, { anonymous: true, headers: session(token) })).data;

export const updateCustomerProfileApi = async (slug: string, token: string, input: { fullName?: string; phone?: string }) =>
  (await apiRequest<CustomerProfileApi>(`${base(slug)}/me`, { method: "PATCH", json: input, anonymous: true, headers: session(token) })).data;

export const changeCustomerPasswordApi = async (slug: string, token: string, input: { currentPassword: string; newPassword: string }) => {
  await apiRequest<null>(`${base(slug)}/password`, { method: "POST", json: input, anonymous: true, headers: session(token) });
};

export const listCustomerAddressesApi = async (slug: string, token: string) => (await apiRequest<CustomerAddressApi[]>(`${base(slug)}/addresses`, { anonymous: true, headers: session(token) })).data;

export const addCustomerAddressApi = async (slug: string, token: string, input: AddressInput) =>
  (await apiRequest<CustomerAddressApi[]>(`${base(slug)}/addresses`, { method: "POST", json: input, anonymous: true, headers: session(token) })).data;

export const updateCustomerAddressApi = async (slug: string, token: string, id: string, input: AddressInput) =>
  (await apiRequest<CustomerAddressApi[]>(`${base(slug)}/addresses/${encodeURIComponent(id)}`, { method: "PUT", json: input, anonymous: true, headers: session(token) })).data;

export const deleteCustomerAddressApi = async (slug: string, token: string, id: string) =>
  (await apiRequest<CustomerAddressApi[]>(`${base(slug)}/addresses/${encodeURIComponent(id)}`, { method: "DELETE", anonymous: true, headers: session(token) })).data;

export const listCustomerOrdersApi = async (slug: string, token: string, page: number) => {
  const r = await apiRequest<AccountOrderSummaryApi[]>(`${base(slug)}/orders`, { anonymous: true, headers: session(token), query: { page, limit: 10 } });
  return { items: r.data, meta: r.meta ?? { page, limit: 10, total: r.data.length, totalPages: 1 } };
};

export const getCustomerOrderApi = async (slug: string, token: string, orderNumber: number) =>
  (await apiRequest<AccountOrderApi>(`${base(slug)}/orders/${orderNumber}`, { anonymous: true, headers: session(token) })).data;

export const cancelCustomerOrderApi = async (slug: string, token: string, orderNumber: number) =>
  (await apiRequest<AccountOrderApi>(`${base(slug)}/orders/${orderNumber}/cancel`, { method: "POST", anonymous: true, headers: session(token) })).data;
