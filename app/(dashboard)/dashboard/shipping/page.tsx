import type { Metadata } from "next";
import Link from "next/link";
import { OriginForm } from "@/components/shipping/origin-form";
import { PreferencesForm } from "@/components/shipping/preferences-form";
import { ShippingNav } from "@/components/shipping/shipping-nav";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManageCarriers, canManageShipping } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getOrigin, getPreferences, listMethods, listZones } from "@/services/shipping.service";

export const metadata: Metadata = { title: "Shipping" };

export default async function ShippingPage() {
  const { active } = await requireWorkspaceCan("shipping:view");
  const [origin, prefs, zones, methods] = await Promise.all([getOrigin(), getPreferences(), listZones(), listMethods()]);
  const stat = (label: string, value: number, href: string, hint: string) => (
    <Link href={href} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/50">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Link>
  );

  return (
    <>
      <PageHeader title="Shipping" description="Where you deliver, what it costs, and who carries it." />
      <ShippingNav />
      <div className="grid max-w-5xl gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {stat("Active carriers", prefs.activeCarrierCount, ROUTES.carriers, prefs.activeCarrierCount ? "Used for rates and booking" : "Connect one to book shipments")}
          {stat("Zones", zones.length, ROUTES.zones, zones.length ? `${zones.filter((z) => z.enabled).length} serving customers` : "Add zones to start delivering")}
          {stat("Delivery methods", methods.length, ROUTES.shippingMethods, `${methods.filter((m) => m.enabled).length} on at checkout`)}
        </div>
        {zones.length === 0 ? <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Until you add a shipping zone, checkout does not charge or restrict delivery. Add one to control where you deliver and what it costs.</p> : null}
        <OriginForm
          canManage={canManageShipping(active)}
          origin={{ name: origin.name ?? "", phone: origin.phone ?? "", email: origin.email ?? "", line1: origin.line1 ?? "", line2: origin.line2 ?? "", city: origin.city ?? "", state: origin.state ?? "", postalCode: origin.postalCode ?? "" }}
        />
        <PreferencesForm selectionMode={prefs.selectionMode} strategy={prefs.strategy} activeCarrierCount={prefs.activeCarrierCount} defaultCarrier={prefs.defaultCarrier} canManage={canManageCarriers(active)} />
      </div>
    </>
  );
}
