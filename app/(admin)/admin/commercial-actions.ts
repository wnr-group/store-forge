"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import type { PlanInputApi } from "@/lib/api/endpoints/platform-business-api";
import {
  assignPlanSchema,
  billingSettingsSchema,
  featureOverrideSchema,
  issueInvoiceSchema,
  limitOverrideSchema,
  manualPaymentSchema,
  percentToBps,
  planFormSchema,
  planStatusSchema,
  planUpdateSchema,
  refundSchema,
  voidInvoiceSchema,
} from "@/lib/validations/admin-commercial";
import { parseInput } from "@/lib/validations/parse";
import {
  assignPlan,
  createPlan,
  issueInvoice,
  recordManualPayment,
  refundPayment,
  runBilling,
  setFeatureOverride,
  setLimitOverride,
  setPlanStatus,
  updateBillingSettings,
  updatePlan,
  voidInvoice,
} from "@/services/platform-commercial.service";

// Every action validates its input with the schema the form used, then calls a service that checks the person's platform role
// BEFORE any work; the API and the database check it again. The id of an organization, plan, invoice or payment is always validated
// as a UUID. Each action is logged as one structured event (operation, outcome, duration, never the input).

const id = z.uuid();
const guarded = <T>(operation: string, fn: () => Promise<T>) => run(fn, { operation });

/** What the form holds -> what the API takes: empty limits mean "unlimited" (null removes the limit), an empty description means none. */
function planBody(v: z.output<typeof planUpdateSchema>): PlanInputApi {
  return {
    name: v.name,
    description: v.description === "" ? null : v.description,
    currency: v.currency,
    monthlyPrice: v.monthlyPrice,
    yearlyPrice: v.yearlyPrice,
    trialDays: v.trialDays,
    sortOrder: v.sortOrder,
    isUnrestricted: v.isUnrestricted,
    ...(v.isDefault ? { isDefault: true } : {}),
    features: v.features,
    limits: Object.fromEntries(
      Object.entries(v.limits).map(([key, l]) => [key, l.soft === null && l.hard === null ? null : { soft: l.soft, hard: l.hard }]),
    ),
  };
}

// Plans -------------------------------------------------------------------------------------------------------------------------
export async function createPlanAction(input: unknown) {
  return guarded("admin.plan.create", async () => {
    const v = parseInput(planFormSchema, input);
    const plan = await createPlan({ code: v.code, ...planBody(v) });
    revalidatePath(ROUTES.adminPlans);
    return { id: plan.id };
  });
}

export async function updatePlanAction(planId: unknown, input: unknown) {
  return guarded("admin.plan.update", async () => {
    await updatePlan(parseInput(id, planId), planBody(parseInput(planUpdateSchema, input)));
    revalidatePath(ROUTES.adminPlans, "layout");
    revalidatePath(ROUTES.adminEntitlements);
  });
}

export async function setPlanStatusAction(planId: unknown, status: unknown) {
  return guarded("admin.plan.set_status", async () => {
    await setPlanStatus(parseInput(id, planId), parseInput(planStatusSchema, status));
    revalidatePath(ROUTES.adminPlans, "layout");
  });
}

// Subscription, entitlements and limits of one organization ------------------------------------------------------------------------
export async function assignPlanAction(tenantId: unknown, input: unknown) {
  return guarded("admin.subscription.assign", async () => {
    const v = parseInput(assignPlanSchema, input);
    await assignPlan(parseInput(id, tenantId), { planId: v.planId, billingInterval: v.billingInterval, startTrial: v.startTrial });
    revalidatePath(`${ROUTES.adminCompanies}/${String(tenantId)}`);
    revalidatePath(ROUTES.adminLimits);
  });
}

export async function setFeatureOverrideAction(tenantId: unknown, input: unknown) {
  return guarded("admin.entitlement.feature", async () => {
    const v = parseInput(featureOverrideSchema, input);
    await setFeatureOverride(parseInput(id, tenantId), v.key, { enabled: v.enabled, note: v.note === "" ? null : v.note });
    revalidatePath(`${ROUTES.adminCompanies}/${String(tenantId)}`);
  });
}

export async function setLimitOverrideAction(tenantId: unknown, input: unknown) {
  return guarded("admin.entitlement.limit", async () => {
    const v = parseInput(limitOverrideSchema, input);
    await setLimitOverride(
      parseInput(id, tenantId),
      v.key,
      v.clear ? { clear: true } : { soft: v.soft, hard: v.hard, note: v.note === "" ? null : v.note },
    );
    revalidatePath(`${ROUTES.adminCompanies}/${String(tenantId)}`);
    revalidatePath(ROUTES.adminLimits);
  });
}

// Billing -----------------------------------------------------------------------------------------------------------------------
export async function issueInvoiceAction(tenantId: unknown, input: unknown) {
  return guarded("admin.billing.issue_invoice", async () => {
    const v = parseInput(issueInvoiceSchema, input);
    const invoice = await issueInvoice(parseInput(id, tenantId), v.period);
    revalidatePath(ROUTES.adminBilling, "layout");
    revalidatePath(`${ROUTES.adminCompanies}/${String(tenantId)}`);
    return { id: invoice.id, number: invoice.number };
  });
}

export async function voidInvoiceAction(invoiceId: unknown, input: unknown) {
  return guarded("admin.billing.void_invoice", async () => {
    await voidInvoice(parseInput(id, invoiceId), parseInput(voidInvoiceSchema, input).reason);
    revalidatePath(ROUTES.adminBilling, "layout");
  });
}

export async function recordManualPaymentAction(invoiceId: unknown, input: unknown) {
  return guarded("admin.billing.manual_payment", async () => {
    const v = parseInput(manualPaymentSchema, input);
    await recordManualPayment(parseInput(id, invoiceId), { reference: v.reference, method: v.method, note: v.note === "" ? null : v.note });
    revalidatePath(ROUTES.adminBilling, "layout");
  });
}

const requestId = z.string().min(8).max(100);
export async function refundPaymentAction(paymentId: unknown, requestIdValue: unknown, input: unknown) {
  return guarded("admin.billing.refund", async () => {
    const v = parseInput(refundSchema, input);
    await refundPayment(parseInput(id, paymentId), {
      requestId: parseInput(requestId, requestIdValue),
      reason: v.reason,
      ...(v.amount === "" ? {} : { amount: v.amount }),
    });
    revalidatePath(ROUTES.adminBilling, "layout");
  });
}

export async function updateBillingSettingsAction(input: unknown) {
  return guarded("admin.billing.settings", async () => {
    const v = parseInput(billingSettingsSchema, input);
    await updateBillingSettings({
      legalName: v.legalName,
      address: v.address === "" ? null : v.address,
      gstin: v.gstin === "" ? null : v.gstin,
      taxLabel: v.taxLabel,
      taxRateBps: percentToBps(v.taxPercent),
      dueDays: v.dueDays,
      graceDays: v.graceDays,
      renewalNoticeDays: v.renewalNoticeDays,
    });
    revalidatePath(ROUTES.adminBillingSettings);
  });
}

export async function runBillingAction() {
  return guarded("admin.billing.run", async () => {
    const result = await runBilling();
    revalidatePath(ROUTES.adminBilling, "layout");
    return result;
  });
}
