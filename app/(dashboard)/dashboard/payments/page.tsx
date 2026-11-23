import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentConfigForm, type PaymentConfigView } from "@/components/payments/payment-config-form";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManagePayments } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { getPaymentConfig } from "@/services/payment.service";

export const metadata: Metadata = { title: "Payments" };

/** Fixed zone and locale, so the server and the browser print the same text. */
const formatUpdatedAt = (at: Date) =>
  `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(at)} UTC`;

export default async function PaymentsPage() {
  const { active } = await requireWorkspace();
  // Owner-only. The service, the API and the database repeat this check; this is just the friendly redirect.
  if (!canManagePayments(active)) redirect(ROUTES.dashboard);
  const config = await getPaymentConfig();
  const view: PaymentConfigView = config.configured
    ? { configured: true, keyIdMasked: config.keyIdMasked, mode: config.mode, webhookSecretConfigured: config.webhookSecretConfigured, updatedAtLabel: formatUpdatedAt(config.updatedAt), updatedByName: config.updatedByName }
    : { configured: false };

  return (
    <>
      <PageHeader title="Payments" description={`Razorpay keys for ${active.tenant.name}.`} />
      <div className="max-w-5xl">
        <PaymentConfigForm config={view} />
      </div>
    </>
  );
}
