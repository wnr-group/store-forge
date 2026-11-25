/**
 * A purchase is reported once per order and browser. The order page can be opened again and again (and reloaded after paying), so
 * the first time one is really sent is remembered. Google also ignores a repeated transaction id, which makes this the second guard.
 */
type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

const PREFIX = "sf-purchase-tracked:v1:";
/** Used when the browser's storage is blocked, so a repeat in the same page visit is still caught. */
const memory = new Set<string>();

export const purchaseKey = (storeSlug: string, orderNumber: number) => `${PREFIX}${storeSlug}:${orderNumber}`;

export function wasPurchaseTracked(storage: Reader | null, storeSlug: string, orderNumber: number): boolean {
  const key = purchaseKey(storeSlug, orderNumber);
  if (memory.has(key)) return true;
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markPurchaseTracked(storage: Writer | null, storeSlug: string, orderNumber: number): void {
  const key = purchaseKey(storeSlug, orderNumber);
  memory.add(key);
  try {
    storage?.setItem(key, "1");
  } catch {
    // Blocked or full: the in-memory copy still covers this visit.
  }
}

/** Test helper: forgets the in-memory copy. */
export const resetPurchaseMemory = () => memory.clear();
