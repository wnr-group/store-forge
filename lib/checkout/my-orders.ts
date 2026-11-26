/**
 * The orders this browser placed in ONE store. The API gives the shopper an order token once, when the order is created;
 * it is the shopper's only way back to the order, so it is kept in this browser under a key that contains the store slug
 * (two stores never share it). A blocked or full localStorage just means the order page cannot be reopened from here.
 */
export type MyOrder = { orderNumber: number; token: string; placedAt: string };

const KEY = (storeSlug: string) => `sf-orders:v1:${storeSlug}`;
const MAX = 30;

export function readMyOrders(storeSlug: string): MyOrder[] {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(KEY(storeSlug)) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter((o): o is MyOrder => !!o && typeof o.orderNumber === "number" && typeof o.token === "string" && typeof o.placedAt === "string")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberOrder(storeSlug: string, order: MyOrder): void {
  try {
    const rest = readMyOrders(storeSlug).filter((o) => o.orderNumber !== order.orderNumber);
    window.localStorage.setItem(KEY(storeSlug), JSON.stringify([order, ...rest].slice(0, MAX)));
  } catch {
    /* storage unavailable: the order is still placed, it just cannot be listed here */
  }
}

export const tokenFor = (storeSlug: string, orderNumber: number): string | null => readMyOrders(storeSlug).find((o) => o.orderNumber === orderNumber)?.token ?? null;

/** A fresh idempotency key for one checkout attempt (8-128 of letters, digits, - and _). */
export const newIdempotencyKey = (): string => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
