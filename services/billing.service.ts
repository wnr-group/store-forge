import "server-only";
import {
  getMyBillingApi,
  getMyEntitlementsApi,
  getMyInvoiceApi,
  listMyInvoicesApi,
  startInvoicePaymentApi,
  verifyInvoicePaymentApi,
} from "@/lib/api/endpoints/billing-api";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * The active organization's plan and what it owes StoreForge. Invoices, payments and paying are Owner-only: the permission is checked
 * BEFORE any API call, the tenant comes from `requireActiveTenant` (never from input), and the API and the database check again.
 * `getMyEntitlements` is for display only (menu, notices) and open to every member; the server refuses disallowed actions anyway.
 */
export async function getMyEntitlements(storage = false) {
  const { tenant } = await requireActiveTenant();
  return getMyEntitlementsApi(tenant.id, storage);
}

export async function getMyBilling() {
  const { tenant } = await requireActiveTenant("billing:manage");
  return getMyBillingApi(tenant.id);
}

export async function listMyInvoices(query: { page?: number; status?: string } = {}) {
  const { tenant } = await requireActiveTenant("billing:manage");
  return listMyInvoicesApi(tenant.id, { page: query.page, status: query.status && query.status !== "all" ? query.status : undefined, limit: 20 });
}

export async function getMyInvoice(id: string) {
  const { tenant } = await requireActiveTenant("billing:manage");
  return getMyInvoiceApi(tenant.id, id);
}

export async function startInvoicePayment(id: string) {
  const { tenant } = await requireActiveTenant("billing:manage");
  return startInvoicePaymentApi(tenant.id, id);
}

export async function verifyInvoicePayment(input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  const { tenant } = await requireActiveTenant("billing:manage");
  return verifyInvoicePaymentApi(tenant.id, input);
}
