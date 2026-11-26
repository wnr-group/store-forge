import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeatureLocked } from "@/components/billing/feature-locked";
import { loadPlanAccess } from "@/components/billing/feature-gate";
import { PaymentConfigForm, type PaymentConfigView } from "@/components/payments/payment-config-form";
import { CodSettingsForm } from "@/components/payments/cod-settings-form";
import { PaymentsNav } from "@/components/payments/payments-nav";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManagePayments } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { getCodSettings } from "@/services/payment-ledger.service";
import { getPaymentConfig } from "@/services/payment.service";

export const metadata: Metadata = { title: "Payments" };

/** Fixed zone and locale, so the server and the browser print the same text. */
const formatUpdatedAt = (at: Date) =>
  `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(at)} UTC`;

export default async function PaymentsPage() {
  const { active, store } = await requireWorkspace();
  // Owner-only. The service, the API and the database repeat this check; this is just the friendly redirect.
  if (!canManagePayments(active)) redirect(ROUTES.dashboard);
  const [config, cod, plan] = await Promise.all([getPaymentConfig(), getCodSettings(), loadPlanAccess()]);
  const online = plan.access("online_payments");
  const view: PaymentConfigView = config.configured
    ? { configured: true, keyIdMasked: config.keyIdMasked, mode: config.mode, webhookSecretConfigured: config.webhookSecretConfigured, enabled: config.enabled, verificationStatus: config.verificationStatus, verificationError: config.verificationError, verifiedAtLabel: config.verifiedAt ? formatUpdatedAt(config.verifiedAt) : null, webhookPath: config.webhookPath, updatedAtLabel: formatUpdatedAt(config.updatedAt), updatedByName: config.updatedByName }
    : { configured: false };

  return (
    <>
      <PageHeader title="Payments" description={`How ${active.tenant.name} gets paid: Razorpay for online payments, and cash on delivery.`} />
      <PaymentsNav />
      <div className="grid max-w-5xl gap-6">
        {/* Saving and checking Razorpay need the plan; an account that is already set up still shows its status. */}
        {online === "enabled" || view.configured ? <PaymentConfigForm config={view} /> : <FeatureLocked label={plan.labelOf("online_payments")} access={online} isOwner={plan.isOwner} />}
        <CodSettingsForm cod={cod} currency={store?.currency ?? "INR"} />
      </div>
    </>
  );
}
