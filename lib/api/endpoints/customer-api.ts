import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/** `/customers` of the StoreForge API. Dates arrive as ISO strings; money is in minor units. */
export type CustomerApi = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  notes: string | null;
  orderCount: number;
  totalSpentMinor: number;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerOrderApi = {
  id: string;
  orderNumber: number;
  status: string;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  placedAt: string;
};

export type CustomerDetailApi = CustomerApi & { orders: CustomerOrderApi[] };

export type CustomerListApiQuery = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: "createdAt" | "name" | "spent" | "orders";
  sortOrder?: "asc" | "desc";
};

export type CustomerApiInput = { fullName: string; email: string; phone: string | null; notes: string | null };

export async function listCustomersApi(organizationId: string, query: CustomerListApiQuery): Promise<{ items: CustomerApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<CustomerApi[]>("/customers", { organizationId, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}

export const getCustomerApi = async (organizationId: string, id: string) =>
  (await apiRequest<CustomerDetailApi>(`/customers/${id}`, { organizationId })).data;

export const createCustomerApi = async (organizationId: string, input: CustomerApiInput) =>
  (await apiRequest<CustomerApi>("/customers", { method: "POST", json: input, organizationId })).data;

export const updateCustomerApi = async (organizationId: string, id: string, input: CustomerApiInput) =>
  (await apiRequest<CustomerApi>(`/customers/${id}`, { method: "PATCH", json: input, organizationId })).data;

export const deleteCustomerApi = async (organizationId: string, id: string) => {
  await apiRequest(`/customers/${id}`, { method: "DELETE", organizationId });
};
