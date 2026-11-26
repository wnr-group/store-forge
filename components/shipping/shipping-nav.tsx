import { SubNav } from "@/components/shared/sub-nav";
import { ROUTES } from "@/config/app";

export function ShippingNav() {
  return (
    <SubNav
      label="Shipping"
      items={[
        { href: ROUTES.shipping, label: "Overview", exact: true },
        { href: ROUTES.carriers, label: "Carriers" },
        { href: ROUTES.zones, label: "Zones" },
        { href: ROUTES.shippingMethods, label: "Methods & rates" },
        { href: ROUTES.shipments, label: "Shipments" },
      ]}
    />
  );
}
