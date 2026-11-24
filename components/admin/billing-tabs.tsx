import { SubNav } from "@/components/shared/sub-nav";
import { ROUTES } from "@/config/app";

/** The sections of Billing & Invoices. Plain links, so each tab is its own server-rendered page. */
export function BillingTabs() {
  return (
    <SubNav
      label="Billing sections"
      items={[
        { href: ROUTES.adminBilling, label: "Overview", exact: true },
        { href: ROUTES.adminInvoices, label: "Invoices" },
        { href: ROUTES.adminPayments, label: "Payments" },
        { href: ROUTES.adminBillingSettings, label: "Settings" },
      ]}
    />
  );
}
