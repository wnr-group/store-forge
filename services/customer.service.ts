import "server-only";
import type { Customer, Order } from "@/lib/domain/entities";
import {
  createCustomerApi,
  deleteCustomerApi,
  getCustomerApi,
  listCustomersApi,
  updateCustomerApi,
  type CustomerApi,
} from "@/lib/api/endpoints/customer-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";
import { PAGE_SIZE, type CustomerListQuery } from "@/lib/validations/catalog";
import type { Paged } from "./product.service";

/**
 * Customers, served by the StoreForge API (`/customers`). Order counts, spend (paid + fulfilled orders only) and the last
 * order date are computed by the API.
 */
export type CustomerRow = Customer & { orderCount: number; totalSpentMinor: number; lastOrderAt: Date | null };

const toRow = (c: CustomerApi, tenantId: string): CustomerRow => ({
  ...c,
  tenantId,
  createdAt: new Date(c.createdAt),
  updatedAt: new Date(c.updatedAt),
  lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt) : null,
});

const SORT_BY = { created: "createdAt", name: "name", spent: "spent", orders: "orders" } as const;

export async function listCustomers(q: CustomerListQuery): Promise<Paged<CustomerRow>> {
  const { tenant } = await requireActiveTenant("customers:view");
  const { items, meta } = await listCustomersApi(tenant.id, { page: q.page, limit: PAGE_SIZE, search: q.q, sortBy: SORT_BY[q.sort], sortOrder: q.dir });
  return { items: items.map((c) => toRow(c, tenant.id)), total: meta.total, page: meta.page, pageSize: PAGE_SIZE };
}

export async function getCustomer(id: string): Promise<{ customer: CustomerRow; orders: Order[] } | null> {
  const { tenant } = await requireActiveTenant("customers:view");
  try {
    const { orders: history, ...customer } = await getCustomerApi(tenant.id, id);
    return {
      customer: toRow(customer, tenant.id),
      orders: history.map((o) => ({ ...o, tenantId: tenant.id, customerId: id, status: o.status as Order["status"], placedAt: new Date(o.placedAt), createdAt: new Date(o.placedAt) })),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

type Values = { fullName: string; email: string; phone: string | null; notes: string | null };

export async function createCustomer(v: Values): Promise<{ id: string }> {
  const { tenant } = await requireActiveTenant("customers:manage");
  const { id } = await createCustomerApi(tenant.id, v);
  return { id };
}

export async function updateCustomer(id: string, v: Values): Promise<void> {
  const { tenant } = await requireActiveTenant("customers:manage");
  await updateCustomerApi(tenant.id, id, v);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { tenant } = await requireActiveTenant("customers:delete");
  await deleteCustomerApi(tenant.id, id);
}
