import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `/tax` of the StoreForge API: GST settings (store settings access) and the tax report (orders access). */
export type TaxSettingsApi = {
  configured: boolean;
  enabled: boolean;
  gstin: string | null;
  legalName: string | null;
  stateCode: string | null;
  stateName: string | null;
  pricesIncludeTax: boolean;
  defaultRateBps: number;
  chargesTaxable: boolean;
  chargesRateBps: number;
  updatedAt: string | null;
};

export type SaveTaxSettingsInput = { enabled: boolean; gstin?: string | null; legalName?: string | null; pricesIncludeTax: boolean; defaultRateBps: number; chargesTaxable: boolean; chargesRateBps: number };

export type TaxReportRowApi = { rateBps: number; lines: number; taxableMinor: number; cgstMinor: number; sgstMinor: number; igstMinor: number; taxMinor: number };
export type TaxReportApi = { from: string; to: string; orders: number; taxedOrders: number; byRate: TaxReportRowApi[]; totals: TaxReportRowApi; chargesTaxMinor: number };

export const getTaxSettingsApi = async (org: string) => (await apiRequest<TaxSettingsApi>("/tax/settings", { organizationId: org })).data;
export const saveTaxSettingsApi = async (org: string, input: SaveTaxSettingsInput) => (await apiRequest<TaxSettingsApi>("/tax/settings", { method: "PUT", json: input, organizationId: org })).data;
export const getTaxReportApi = async (org: string, query: { from?: string; to?: string }) => (await apiRequest<TaxReportApi>("/tax/report", { organizationId: org, query })).data;
