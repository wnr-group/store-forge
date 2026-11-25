import "server-only";
import { getTaxReportApi, getTaxSettingsApi, saveTaxSettingsApi, type SaveTaxSettingsInput } from "@/lib/api/endpoints/tax-api";
import { withTenant } from "@/lib/tenant/with-tenant";

/** GST for the ACTIVE tenant: settings need `tax:view` / `tax:manage` (store settings access), the report needs `tax:report` (orders access). */
export const getTaxSettings = () => withTenant("tax:view", getTaxSettingsApi);
export const saveTaxSettings = (input: SaveTaxSettingsInput) => withTenant("tax:manage", (o) => saveTaxSettingsApi(o, input));
export const getTaxReport = (query: { from?: string; to?: string }) => withTenant("tax:report", (o) => getTaxReportApi(o, query));
