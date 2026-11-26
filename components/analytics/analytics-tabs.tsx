import { SubNav } from "@/components/shared/sub-nav";
import { ROUTES } from "@/config/app";
import { can, type Actor } from "@/lib/auth/permissions";

/** The report pages a member may open: sales and products follow orders access, customers follow customers access. */
export function AnalyticsTabs({ actor }: { actor: Actor }) {
  const items = [
    { href: ROUTES.analytics, label: "Overview", exact: true, show: can(actor, "orders:view") },
    { href: ROUTES.analyticsSales, label: "Sales and revenue", show: can(actor, "marketing:view") },
    { href: ROUTES.analyticsProducts, label: "Products", show: can(actor, "marketing:view") },
    { href: ROUTES.analyticsCustomers, label: "Customers", show: can(actor, "customers:view") },
  ].filter((i) => i.show);
  return items.length > 1 ? <SubNav label="Reports" items={items.map(({ href, label, exact }) => ({ href, label, exact }))} /> : null;
}
