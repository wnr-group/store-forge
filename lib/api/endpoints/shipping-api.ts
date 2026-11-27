import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/**
 * `/shipping` and `/shipments` of the StoreForge API. Zones, methods, the origin and shipments follow store settings /
 * orders; carrier accounts and selection are Owner-only. Carrier secrets go out in `saveCarrierApi` and are never returned.
 */
export type CarrierApi = {
  code: string;
  name: string;
  capabilities: { serviceability: boolean; rateQuotes: boolean; ratesAreEstimates: boolean; createShipment: boolean; cancelShipment: boolean; labels: boolean; tracking: boolean; trackingWebhooks: boolean; cashOnDelivery: boolean };
  integrationStatus: "documented" | "partially_documented" | "unverified";
  integrationNotes: string;
  credentialFields: { key: string; label: string; required: boolean; secret: boolean; help?: string; options?: string[] }[];
  connection: {
    connected: boolean;
    enabled: boolean;
    isDefault: boolean;
    verificationStatus: "unverified" | "verified" | "failed";
    verifiedAt: string | null;
    verificationError: string | null;
    settings: Record<string, string>;
    secretFieldsSaved: string[];
    updatedAt: string | null;
    updatedByName: string | null;
  };
};

export type CarrierEventApi = { id: string; providerCode: string; action: string; actorName: string | null; note: string | null; createdAt: string };
export type PreferencesApi = { selectionMode: "manual" | "automatic"; strategy: "lowest_cost" | "fastest" | "preferred"; activeCarrierCount: number; defaultCarrier: string | null; updatedAt: string | null };
export type OriginApi = { configured: boolean; name: string | null; phone: string | null; email: string | null; line1: string | null; line2: string | null; city: string | null; state: string | null; postalCode: string | null; updatedAt: string | null };

export type ZoneAreasInput = { country?: boolean; states?: string[]; cities?: { state: string; city: string }[]; postalCodes?: string[]; postalRanges?: { from: string; to: string }[] };
export type ZoneApi = {
  id: string;
  name: string;
  enabled: boolean;
  codAllowed: boolean;
  areaSummary: { country: boolean; states: number; cities: number; postalCodes: number; postalRanges: number };
  methodCount: number;
  createdAt: string;
  updatedAt: string;
};
export type ZoneDetailApi = ZoneApi & {
  areas: { country: boolean; states: { code: string; name: string }[]; cities: { stateCode: string; state: string; city: string }[]; postalCodes: string[]; postalRanges: { from: string; to: string }[] };
};
export type SaveZoneInput = { name: string; enabled?: boolean; codAllowed?: boolean; areas: ZoneAreasInput };

export type PricingType = "flat" | "free" | "weight" | "order_value" | "carrier";
export type MethodApi = {
  id: string;
  zoneId: string;
  zoneName: string;
  name: string;
  kind: "standard" | "express";
  pricingType: PricingType;
  flatRateMinor: number;
  freeOverMinor: number | null;
  handlingMinor: number;
  minOrderMinor: number;
  maxOrderMinor: number | null;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  codAllowed: boolean;
  carrierCode: string | null;
  sortOrder: number;
  enabled: boolean;
  tiers: { from: number; to: number | null; rateMinor: number }[];
  createdAt: string;
  updatedAt: string;
};
export type SaveMethodInput = {
  zoneId: string;
  name: string;
  kind?: "standard" | "express";
  pricingType: PricingType;
  flatRateMinor?: number;
  freeOverMinor?: number | null;
  handlingMinor?: number;
  minOrderMinor?: number;
  maxOrderMinor?: number | null;
  minWeightGrams?: number;
  maxWeightGrams?: number | null;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  codAllowed?: boolean;
  carrierCode?: string | null;
  sortOrder?: number;
  enabled?: boolean;
  tiers?: { from: number; to?: number | null; rateMinor: number }[];
};

export type ShipmentApi = {
  id: string;
  orderId: string;
  orderNumber: number;
  status: string;
  providerCode: string;
  courierName: string | null;
  serviceCode: string | null;
  awb: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  paymentMode: "prepaid" | "cod";
  codAmountMinor: number;
  declaredValueMinor: number;
  weightGrams: number;
  hasLabel: boolean;
  labelUrl: string | null;
  failureReason: string | null;
  lastSyncedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};
export type ShipmentDetailApi = ShipmentApi & {
  items: { orderItemId: string; name: string; sku: string | null; quantity: number }[];
  events: { status: string; description: string; location: string | null; occurredAt: string | null; source: string; recordedAt: string }[];
};

export type CarrierComparisonApi = {
  candidates: { providerCode: string; providerName: string; serviceCode: string; serviceName: string; amountMinor: number; estimatedDeliveryDays: number | null; codChargeMinor: number | null; estimate: boolean }[];
  skipped?: { providerCode: string; providerName: string; reason: string }[];
  choice?: { candidate: unknown; strategy: string; fellBack: boolean; reason: string };
};

const j = (organizationId: string, method: "POST" | "PUT" | "PATCH" | "DELETE", json?: unknown) => ({ method, json, organizationId });

// --- carriers ---
export const listCarriersApi = async (org: string) => (await apiRequest<CarrierApi[]>("/shipping/carriers", { organizationId: org })).data;
export const saveCarrierApi = async (org: string, code: string, values: Record<string, string>) => (await apiRequest<CarrierApi>(`/shipping/carriers/${code}`, j(org, "PUT", { values }))).data;
export const testCarrierApi = async (org: string, code: string) => (await apiRequest<{ valid: boolean; message: string }>(`/shipping/carriers/${code}/test`, { ...j(org, "POST"), timeoutMs: 30_000 })).data;
export const verifyCarrierApi = async (org: string, code: string) => (await apiRequest<{ valid: boolean; message: string }>(`/shipping/carriers/${code}/verify`, { ...j(org, "POST"), timeoutMs: 30_000 })).data;
export const setCarrierEnabledApi = async (org: string, code: string, enabled: boolean, acknowledgeUnverifiedIntegration?: boolean) =>
  (await apiRequest<CarrierApi>(`/shipping/carriers/${code}/enabled`, j(org, "PUT", { enabled, acknowledgeUnverifiedIntegration }))).data;
export const setCarrierDefaultApi = async (org: string, code: string, isDefault: boolean) => (await apiRequest<CarrierApi>(`/shipping/carriers/${code}/default`, j(org, "PUT", { isDefault }))).data;
export const disconnectCarrierApi = async (org: string, code: string) => {
  await apiRequest<unknown>(`/shipping/carriers/${code}`, j(org, "DELETE"));
};
export async function listCarrierEventsApi(org: string, query: { page: number; limit: number }): Promise<{ items: CarrierEventApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<CarrierEventApi[]>("/shipping/carrier-events", { organizationId: org, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}
export const getPreferencesApi = async (org: string) => (await apiRequest<PreferencesApi>("/shipping/preferences", { organizationId: org })).data;
export const savePreferencesApi = async (org: string, input: { selectionMode: string; strategy: string }) => (await apiRequest<PreferencesApi>("/shipping/preferences", j(org, "PUT", input))).data;

// --- origin, zones, methods ---
export const getOriginApi = async (org: string) => (await apiRequest<OriginApi>("/shipping/origin", { organizationId: org })).data;
export const saveOriginApi = async (org: string, input: Record<string, string | undefined>) => (await apiRequest<OriginApi>("/shipping/origin", j(org, "PUT", input))).data;
export const listZonesApi = async (org: string) => (await apiRequest<ZoneApi[]>("/shipping/zones", { organizationId: org })).data;
export const getZoneApi = async (org: string, id: string) => (await apiRequest<ZoneDetailApi>(`/shipping/zones/${id}`, { organizationId: org })).data;
export const createZoneApi = async (org: string, input: SaveZoneInput) => (await apiRequest<ZoneDetailApi>("/shipping/zones", j(org, "POST", input))).data;
export const updateZoneApi = async (org: string, id: string, input: SaveZoneInput) => (await apiRequest<ZoneDetailApi>(`/shipping/zones/${id}`, j(org, "PUT", input))).data;
export const deleteZoneApi = async (org: string, id: string) => {
  await apiRequest<unknown>(`/shipping/zones/${id}`, j(org, "DELETE"));
};
export const listMethodsApi = async (org: string, zoneId?: string) => (await apiRequest<MethodApi[]>("/shipping/methods", { organizationId: org, query: { zoneId } })).data;
export const getMethodApi = async (org: string, id: string) => (await apiRequest<MethodApi>(`/shipping/methods/${id}`, { organizationId: org })).data;
export const createMethodApi = async (org: string, input: SaveMethodInput) => (await apiRequest<MethodApi>("/shipping/methods", j(org, "POST", input))).data;
export const updateMethodApi = async (org: string, id: string, input: SaveMethodInput) => (await apiRequest<MethodApi>(`/shipping/methods/${id}`, j(org, "PUT", input))).data;
export const deleteMethodApi = async (org: string, id: string) => {
  await apiRequest<unknown>(`/shipping/methods/${id}`, j(org, "DELETE"));
};

// --- shipments ---
export async function listShipmentsApi(org: string, query: { page: number; limit: number; search?: string; status?: string; providerCode?: string }): Promise<{ items: ShipmentApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<ShipmentApi[]>("/shipments", { organizationId: org, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}
export const listOrderShipmentsApi = async (org: string, orderId: string) => (await apiRequest<ShipmentApi[]>(`/orders/${orderId}/shipments`, { organizationId: org })).data;
export const createShipmentApi = async (org: string, orderId: string, input: { providerCode?: string; serviceCode?: string; weightGrams?: number; lengthCm?: number; breadthCm?: number; heightCm?: number }) =>
  (await apiRequest<ShipmentDetailApi>(`/orders/${orderId}/shipments`, { ...j(org, "POST", input), timeoutMs: 45_000 })).data;
/** A parcel the store sent with its own courier (no carrier integration): provider name and tracking number typed by the owner. */
export type ManualShipmentInput = { courierName: string; trackingNumber: string; trackingUrl?: string; estimatedDelivery?: string };
export type ManualShipmentUpdate = Partial<ManualShipmentInput> & { status?: "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "returned" };
export const recordManualShipmentApi = async (org: string, orderId: string, input: ManualShipmentInput) => (await apiRequest<ShipmentDetailApi>(`/orders/${orderId}/shipments/manual`, j(org, "POST", input))).data;
export const updateManualShipmentApi = async (org: string, id: string, input: ManualShipmentUpdate) => (await apiRequest<ShipmentDetailApi>(`/shipments/${id}/manual`, j(org, "PATCH", input))).data;
export const getShipmentApi = async (org: string, id: string) => (await apiRequest<ShipmentDetailApi>(`/shipments/${id}`, { organizationId: org })).data;
export const retryShipmentApi = async (org: string, id: string) => (await apiRequest<ShipmentDetailApi>(`/shipments/${id}/retry`, { ...j(org, "POST"), timeoutMs: 45_000 })).data;
export const cancelShipmentApi = async (org: string, id: string) => (await apiRequest<ShipmentDetailApi>(`/shipments/${id}/cancel`, { ...j(org, "POST"), timeoutMs: 45_000 })).data;
export const refreshShipmentApi = async (org: string, id: string) => (await apiRequest<ShipmentDetailApi>(`/shipments/${id}/refresh`, { ...j(org, "POST"), timeoutMs: 30_000 })).data;
export const getShipmentLabelApi = async (org: string, id: string) => (await apiRequest<{ available: boolean; url: string | null; stored: boolean }>(`/shipments/${id}/label`, { organizationId: org })).data;
export const generateShipmentLabelApi = async (org: string, id: string) => (await apiRequest<{ available: boolean; url: string | null; stored: boolean }>(`/shipments/${id}/label`, { ...j(org, "POST"), timeoutMs: 45_000 })).data;
