import { SubNav } from "@/components/shared/sub-nav";
import { ROUTES } from "@/config/app";

export function PaymentsNav() {
  return (
    <SubNav
      label="Payments"
      items={[
        { href: ROUTES.payments, label: "Settings", exact: true },
        { href: ROUTES.transactions, label: "Transactions" },
        { href: ROUTES.refunds, label: "Refunds" },
      ]}
    />
  );
}
