import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CarrierCard } from "@/components/shipping/carrier-card";
import { ShippingNav } from "@/components/shipping/shipping-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ROUTES } from "@/config/app";
import { canManageCarriers } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { requireWorkspace } from "@/lib/tenant/context";
import { listCarrierEvents, listCarriers } from "@/services/shipping.service";

export const metadata: Metadata = { title: "Carriers" };

export default async function CarriersPage() {
  const { active, store } = await requireWorkspace();
  // Owner-only. The service, the API and the database repeat this check; this is the friendly redirect.
  if (!canManageCarriers(active)) redirect(ROUTES.shipping);
  const [carriers, events] = await Promise.all([listCarriers(), listCarrierEvents(1)]);
  const timezone = store?.timezone ?? "UTC";

  return (
    <>
      <PageHeader title="Shipping" description={`Connect your own carrier accounts for ${active.tenant.name}. Each carrier uses your credentials; nothing is shared with other stores.`} />
      <ShippingNav />
      <div className="grid max-w-5xl gap-5">
        {carriers.map((c) => (
          <CarrierCard key={c.code} carrier={c} />
        ))}
        <SectionCard title="Recent activity" description="Who connected, changed or turned a carrier on or off. Secrets are never recorded.">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium capitalize">{e.providerCode}</span> · {e.action.replace(/_/g, " ")}
                    {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {e.actorName ?? "Former member"} · {formatDateTime(new Date(e.createdAt), timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
