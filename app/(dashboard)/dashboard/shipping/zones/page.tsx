import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ShippingNav } from "@/components/shipping/shipping-nav";
import { ZoneManager } from "@/components/shipping/zone-manager";
import { canManageShipping } from "@/lib/auth/permissions";
import type { ZoneDetailApi } from "@/lib/api/endpoints/shipping-api";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getZone, listZones } from "@/services/shipping.service";

export const metadata: Metadata = { title: "Shipping zones" };

export default async function ZonesPage() {
  const { active } = await requireWorkspaceCan("shipping:view");
  const zones = await listZones();
  // The editor needs each zone's full area list, so they are read here (a store has a handful of zones).
  const details: Record<string, ZoneDetailApi> = Object.fromEntries(await Promise.all(zones.map(async (z) => [z.id, await getZone(z.id)] as const)));

  return (
    <>
      <PageHeader title="Shipping" description="Zones decide where you deliver. Add delivery methods and rates to each zone." />
      <ShippingNav />
      <div className="max-w-4xl">
        <ZoneManager zones={zones} details={details} canManage={canManageShipping(active)} />
      </div>
    </>
  );
}
