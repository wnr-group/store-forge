import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MethodManager } from "@/components/shipping/method-manager";
import { ShippingNav } from "@/components/shipping/shipping-nav";
import { canManageShipping } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listMethods, listZones } from "@/services/shipping.service";

export const metadata: Metadata = { title: "Delivery methods" };

export default async function MethodsPage() {
  const { active, store } = await requireWorkspaceCan("shipping:view");
  const [zones, methods] = await Promise.all([listZones(), listMethods()]);

  return (
    <>
      <PageHeader title="Shipping" description="Delivery methods and rates for each zone: flat, free, by weight, by order value, or a live carrier rate." />
      <ShippingNav />
      <div className="max-w-4xl">
        <MethodManager methods={methods} zones={zones} currency={store?.currency ?? "INR"} canManage={canManageShipping(active)} />
      </div>
    </>
  );
}
