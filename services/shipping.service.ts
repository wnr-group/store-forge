import "server-only";
import * as api from "@/lib/api/endpoints/shipping-api";
import { AppError } from "@/lib/errors";
import { withTenant } from "@/lib/tenant/with-tenant";
import type { Paged } from "./order.service";

/**
 * Shipping for the ACTIVE tenant. Carrier accounts and selection are Owner-only (`carriers:manage`); zones, methods and the
 * origin need `shipping:view` / `shipping:manage`; shipments follow orders (`orders:view` / `orders:manage`). The API
 * checks every one again and is the only place a carrier is called.
 */
export const SHIPPING_PAGE_SIZE = 20;

// carriers (Owner)
export const listCarriers = () => withTenant("carriers:manage", api.listCarriersApi);
export const saveCarrier = (code: string, values: Record<string, string>) => withTenant("carriers:manage", (o) => api.saveCarrierApi(o, code, values));
export const testCarrier = (code: string) => withTenant("carriers:manage", (o) => api.testCarrierApi(o, code));
export const verifyCarrier = (code: string) => withTenant("carriers:manage", (o) => api.verifyCarrierApi(o, code));
export const setCarrierEnabled = (code: string, enabled: boolean, ack?: boolean) => withTenant("carriers:manage", (o) => api.setCarrierEnabledApi(o, code, enabled, ack));
export const setCarrierDefault = (code: string, isDefault: boolean) => withTenant("carriers:manage", (o) => api.setCarrierDefaultApi(o, code, isDefault));
export const disconnectCarrier = (code: string) => withTenant("carriers:manage", (o) => api.disconnectCarrierApi(o, code));
export const getPreferences = () => withTenant("shipping:view", api.getPreferencesApi);
export const savePreferences = (input: { selectionMode: string; strategy: string }) => withTenant("carriers:manage", (o) => api.savePreferencesApi(o, input));
export const listCarrierEvents = (page: number) => withTenant("carriers:manage", async (o) => (await api.listCarrierEventsApi(o, { page, limit: 10 })).items);

// origin, zones, methods
export const getOrigin = () => withTenant("shipping:view", api.getOriginApi);
export const saveOrigin = (input: Record<string, string | undefined>) => withTenant("shipping:manage", (o) => api.saveOriginApi(o, input));
export const listZones = () => withTenant("shipping:view", api.listZonesApi);
export const getZone = (id: string) => withTenant("shipping:view", (o) => api.getZoneApi(o, id));
export const createZone = (input: api.SaveZoneInput) => withTenant("shipping:manage", (o) => api.createZoneApi(o, input));
export const updateZone = (id: string, input: api.SaveZoneInput) => withTenant("shipping:manage", (o) => api.updateZoneApi(o, id, input));
export const deleteZone = (id: string) => withTenant("shipping:manage", (o) => api.deleteZoneApi(o, id));
export const listMethods = (zoneId?: string) => withTenant("shipping:view", (o) => api.listMethodsApi(o, zoneId));
export const createMethod = (input: api.SaveMethodInput) => withTenant("shipping:manage", (o) => api.createMethodApi(o, input));
export const updateMethod = (id: string, input: api.SaveMethodInput) => withTenant("shipping:manage", (o) => api.updateMethodApi(o, id, input));
export const deleteMethod = (id: string) => withTenant("shipping:manage", (o) => api.deleteMethodApi(o, id));

// shipments (orders access)
export async function listShipments(q: { page: number; search?: string; status?: string; providerCode?: string }): Promise<Paged<api.ShipmentApi>> {
  return withTenant("orders:view", async (o) => {
    const { items, meta } = await api.listShipmentsApi(o, { ...q, limit: SHIPPING_PAGE_SIZE });
    return { items, total: meta.total, page: meta.page, pageSize: SHIPPING_PAGE_SIZE };
  });
}

export async function getShipment(id: string) {
  return withTenant("orders:view", async (o) => {
    try {
      return await api.getShipmentApi(o, id);
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  });
}

export const retryShipment = (id: string) => withTenant("orders:manage", (o) => api.retryShipmentApi(o, id));
export const cancelShipment = (id: string) => withTenant("orders:manage", (o) => api.cancelShipmentApi(o, id));
export const refreshShipment = (id: string) => withTenant("orders:manage", (o) => api.refreshShipmentApi(o, id));
export const generateShipmentLabel = (id: string) => withTenant("orders:manage", (o) => api.generateShipmentLabelApi(o, id));
