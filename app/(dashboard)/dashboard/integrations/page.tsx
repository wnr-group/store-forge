import type { Metadata } from "next";
import { FeatureLocked } from "@/components/billing/feature-locked";
import { loadPlanAccess } from "@/components/billing/feature-gate";
import { IntegrationCard, type IntegrationView } from "@/components/integrations/integration-card";
import { PageHeader } from "@/components/shared/page-header";
import { canManageIntegrations } from "@/lib/auth/permissions";
import { PROVIDER_FEATURE } from "@/lib/billing/features";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getIntegration, listIntegrations } from "@/services/integrations.service";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { active, store } = await requireWorkspaceCan("integrations:view");
  const timezone = store?.timezone ?? "Asia/Kolkata";
  const [list, plan] = await Promise.all([listIntegrations(), loadPlanAccess()]);
  // The recent changes of every integration that has been set up.
  const details = await Promise.all(list.map((i) => (i.configured ? getIntegration(i.provider) : Promise.resolve(null))));

  const views: IntegrationView[] = list.map((i, idx) => ({
    provider: i.provider,
    name: i.name,
    description: i.description,
    configured: i.configured,
    enabled: i.enabled,
    validationStatus: i.validationStatus,
    validationError: i.validationError,
    config: i.config,
    identifierLabel: i.fields[0]?.label ?? "ID",
    identifierKey: i.fields[0]?.key ?? "",
    updatedLabel: i.updatedAt ? formatDate(new Date(i.updatedAt), timezone) : null,
    updatedByYou: i.updatedByYou,
    history: (details[idx]?.history ?? []).map((e) => ({ action: e.action, note: e.note, byYou: e.byYou, when: formatDateTime(new Date(e.createdAt), timezone) })),
  }));

  return (
    <>
      <PageHeader title="Integrations" description="Connect your own analytics. Each store uses only its own settings, and nothing is measured until a shopper agrees." />
      <div className="grid max-w-3xl gap-6">
        {views.map((v) => {
          // Connecting needs the plan; one that is already set up stays visible so it can still be switched off or removed.
          const feature = PROVIDER_FEATURE[v.provider];
          const state = feature ? plan.access(feature) : "enabled";
          if (state !== "enabled" && !v.configured && feature) return <FeatureLocked key={v.provider} label={`${v.name} integration`} access={state} isOwner={plan.isOwner} className="py-8" />;
          return <IntegrationCard key={v.provider} view={v} canManage={canManageIntegrations(active)} />;
        })}
      </div>
    </>
  );
}
