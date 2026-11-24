"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkpointCartAction } from "@/app/s/[slug]/cart/actions";
import { paymentOptionsAction, placeOrderAction, quoteAction, shippingOptionsAction, validateDiscountAction } from "@/app/s/[slug]/checkout/actions";
import type { PaymentMethodKind, PaymentOptionsApi, QuoteApi, ShippingQuoteApi } from "@/lib/api/endpoints/checkout-api";
import { formatBagPrice } from "@/lib/cart/format";
import { INDIAN_STATE_NAMES } from "@/lib/checkout/states";
import { clearCartKey, getCartKey, takePrefill } from "@/lib/checkout/cart-key";
import { newIdempotencyKey, rememberOrder } from "@/lib/checkout/my-orders";
import { publicImageUrl } from "@/lib/storage/paths";
import { addressSchema, customerSchema, PHONE_PATTERN, PINCODE_PATTERN } from "@/lib/validations/checkout";
import { cn } from "@/lib/utils";
import { useOptionalCart } from "../cart/cart-provider";
import { useTracker } from "../tracking/tracking-provider";
import type { SectionProps } from "../engine/looks";
import { DiscountBox } from "./discount-box";
import { Field, formatDays, INPUT, MUTED, Notice, PageTitle, PRIMARY_BUTTON, Row, SHELL, TaxBreakdown } from "./checkout-ui";
import { payWithRazorpay } from "./razorpay";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  billingSame: boolean;
  bFullName: string;
  bPhone: string;
  bLine1: string;
  bLine2: string;
  bCity: string;
  bState: string;
  bPostalCode: string;
};

const EMPTY: FormState = { fullName: "", email: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", billingSame: true, bFullName: "", bPhone: "", bLine1: "", bLine2: "", bCity: "", bState: "", bPostalCode: "" };

type CheckoutIssue = { code: string; productSlug: string; variantId: string | null; available?: number; currentUnitPriceMinor?: number };

const ISSUE_TEXT: Record<string, (name: string, i: CheckoutIssue) => string> = {
  PRODUCT_UNAVAILABLE: (n) => `${n} is no longer available.`,
  VARIANT_REQUIRED: (n) => `Choose an option for ${n}.`,
  VARIANT_UNAVAILABLE: (n) => `That option of ${n} is no longer available.`,
  OUT_OF_STOCK: (n, i) => (i.available ? `Only ${i.available} of ${n} left.` : `${n} is sold out.`),
  PRICE_CHANGED: (n) => `The price of ${n} has changed.`,
};

/** The API's refusal of a discount code carries its `reason` (EXPIRED, USAGE_LIMIT, MIN_SUBTOTAL ...). */
const isDiscountRefusal = (details: unknown): boolean => typeof details === "object" && details !== null && typeof (details as { reason?: unknown }).reason === "string";

const browserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const issuesOf = (details: unknown): CheckoutIssue[] => {
  const list = (details as { issues?: unknown } | undefined)?.issues;
  return Array.isArray(list) ? (list as CheckoutIssue[]) : [];
};

/**
 * The checkout page. The bag lives in this browser, but nothing about money is decided here: delivery options, GST, the COD
 * charge and the total all come from the API (`/checkout/quote`, `/shipping/options`), which prices the cart from the
 * database. Placing the order sends only what the shopper chose; Razorpay payment is verified by the server.
 */
export function CheckoutPageSection({ context, sectionId }: SectionProps) {
  const cart = useOptionalCart();
  const router = useRouter();
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pref, setPref] = useState<PaymentMethodKind | null>(null);
  const [options, setOptions] = useState<PaymentOptionsApi | null>(null);
  const [shippingRes, setShippingRes] = useState<{ key: string; data: ShippingQuoteApi | null; error: string | null; issues: CheckoutIssue[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [quoteRes, setQuoteRes] = useState<{ key: string; data: QuoteApi | null; error: string | null; issues: CheckoutIssue[] } | null>(null);
  const [submitIssues, setSubmitIssues] = useState<CheckoutIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const placed = useRef(false);
  // A discount code: the server says whether it works and what it is worth (a preview here, priced again by the quote and the order).
  const [discount, setDiscount] = useState<{ code: string; discountMinor: number } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);
  const [remindMe, setRemindMe] = useState(false);

  const storeSlug = cart?.storeSlug ?? "";
  const currency = cart?.currency ?? "INR";
  const lines = useMemo(() => cart?.lines ?? [], [cart?.lines]);
  const ready = cart?.ready ?? false;
  const subtotal = cart?.subtotalMinor ?? 0;
  const revalidate = cart?.revalidate;

  // Once per visit, as soon as there is a bag to check out and the shopper has agreed to analytics.
  const { track } = useTracker();
  const began = useRef(false);
  useEffect(() => {
    if (began.current || isPreview || !ready || lines.length === 0) return;
    const items = lines.map((l) => ({ id: l.productSlug, name: l.name, variant: l.variantTitle, priceMinor: l.unitPriceMinor, quantity: l.quantity }));
    if (track({ type: "begin_checkout", currency: cart?.currency ?? "INR", items })) began.current = true;
  }, [track, isPreview, ready, lines, cart?.currency]);


  const payload = useMemo(() => lines.map((l) => ({ productSlug: l.productSlug, variantId: l.variantId, quantity: l.quantity, expectedUnitPriceMinor: l.unitPriceMinor })), [lines]);
  const linesSignature = JSON.stringify(payload);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const emailValid = customerSchema.shape.email.safeParse(form.email).success;

  // What a recovery link left for this checkout: the email and name the shopper gave before.
  useEffect(() => {
    if (isPreview || !storeSlug) return;
    const saved = takePrefill(storeSlug, browserStorage());
    // Read once from this browser after mounting (reading it while rendering would differ from the server's page).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setForm((f) => ({ ...f, email: f.email || saved.email || "", fullName: f.fullName || saved.fullName || "" }));
  }, [isPreview, storeSlug]);

  // Once there is an email, keep a copy of the bag with the store, so it can be recovered if the shopper leaves. This never blocks or
  // slows the checkout: it runs a moment after typing stops, and a failure is ignored.
  useEffect(() => {
    if (isPreview || !ready || lines.length === 0 || !emailValid || !storeSlug) return;
    const timer = window.setTimeout(() => {
      const phone = form.phone.trim();
      void checkpointCartAction({
        storeSlug,
        cartKey: getCartKey(storeSlug, browserStorage()),
        lines: JSON.parse(linesSignature),
        customer: { email: form.email.trim(), fullName: form.fullName.trim() || undefined, phone: PHONE_PATTERN.test(phone) ? phone : undefined },
        marketingConsent: remindMe,
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isPreview, ready, lines.length, linesSignature, emailValid, form.email, form.fullName, form.phone, remindMe, storeSlug]);

  async function applyDiscount(code: string) {
    setDiscountChecking(true);
    setDiscountError(null);
    const r = await validateDiscountAction({ storeSlug, code, lines: JSON.parse(linesSignature), customerEmail: emailValid ? form.email.trim() : undefined });
    setDiscountChecking(false);
    if (!r.ok) return setDiscountError(r.error);
    const d = r.data!;
    if (d.valid && d.code) setDiscount({ code: d.code, discountMinor: d.discountMinor });
    else setDiscountError(d.message ?? "This discount code is not valid.");
  }

  // The bag changed: ask again what the code is worth now (it may no longer apply).
  const appliedCode = discount?.code;
  useEffect(() => {
    if (!appliedCode || isPreview) return;
    let current = true;
    void validateDiscountAction({ storeSlug, code: appliedCode, lines: JSON.parse(linesSignature), customerEmail: emailValid ? form.email.trim() : undefined }).then((r) => {
      if (!current) return;
      const d = r.ok ? r.data! : null;
      if (d?.valid && d.code) setDiscount((prev) => (prev && prev.code === d.code ? { code: d.code!, discountMinor: d.discountMinor } : prev));
      else {
        setDiscount(null);
        setDiscountError(d?.message ?? (r.ok ? "This discount code is no longer valid." : r.error));
      }
    });
    return () => {
      current = false;
    };
    // Only a different bag (or a different code) is worth asking again about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCode, linesSignature, storeSlug, isPreview]);

  // Once per visit, check the saved bag against the store's live products (a removed product or a new price shows up here).
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current || !ready || lines.length === 0 || !revalidate || isPreview) return;
    checked.current = true;
    void revalidate().then((r) => {
      if (!r) return;
      const parts: string[] = [];
      if (r.removed.length) parts.push(`${r.removed.join(", ")} ${r.removed.length === 1 ? "is" : "are"} no longer available and ${r.removed.length === 1 ? "was" : "were"} removed from your bag.`);
      if (r.priceChanged.length) parts.push(`The price of ${r.priceChanged.join(", ")} has changed.`);
      if (parts.length) setNotice(parts.join(" "));
    });
  }, [ready, lines.length, revalidate, isPreview]);

  // Which payment methods the store offers for this order value.
  useEffect(() => {
    if (!ready || lines.length === 0 || isPreview) return;
    let live = true;
    void paymentOptionsAction({ storeSlug, subtotalMinor: subtotal }).then((r) => {
      if (live && r.ok && r.data) setOptions(r.data);
    });
    return () => {
      live = false;
    };
  }, [ready, lines.length, subtotal, storeSlug, isPreview]);

  const addressReady = !!form.state && PINCODE_PATTERN.test(form.postalCode.trim());
  const addressKey = `${form.state}|${form.postalCode.trim()}|${form.city.trim()}`;
  const active = ready && lines.length > 0 && !isPreview;

  // Delivery options for this cart and address (priced by the server, carriers included). A result belongs to the request key
  // it was fetched for, so one for an older cart or address is never shown.
  const shippingKey = active && addressReady ? `${linesSignature}|${addressKey}|${pref ?? ""}` : null;
  useEffect(() => {
    if (!shippingKey) return;
    let current = true;
    const timer = window.setTimeout(() => {
      void shippingOptionsAction({ storeSlug, lines: JSON.parse(linesSignature), address: { state: form.state, city: form.city.trim() || undefined, postalCode: form.postalCode.trim() }, paymentMethod: pref ?? undefined }).then((r) => {
        if (!current) return;
        setShippingRes(r.ok ? { key: shippingKey, data: r.data!, error: null, issues: [] } : { key: shippingKey, data: null, error: r.error, issues: issuesOf("details" in r ? r.details : undefined) });
      });
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
    // The key already covers the cart, the address and the payment method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingKey, storeSlug]);

  const shippingFresh = shippingKey !== null && shippingRes?.key === shippingKey ? shippingRes : null;
  const shippingBusy = shippingKey !== null && !shippingFresh;
  const shipping = shippingFresh?.data ?? null;
  const needsMethod = shipping?.configured === true;
  const cheapest = shipping?.options.slice().sort((a, b) => a.chargeMinor - b.chargeMinor)[0] ?? null;
  const chosen = shipping?.options.find((o) => o.methodId === picked) ?? cheapest;
  const methodId = chosen?.methodId ?? null;

  // Cash on delivery stops being offered when the chosen delivery option or zone does not allow it.
  const codAllowedHere = !!options?.codAvailable && (!chosen || chosen.codAllowed) && (!shipping?.zone || shipping.zone.codAllowed);
  const codBlockedByMethod = pref === "cod" && !!chosen && !chosen.codAllowed;
  const fallback: PaymentMethodKind | null = options?.razorpayAvailable ? "razorpay" : codAllowedHere ? "cod" : null;
  const method: PaymentMethodKind | null = pref === "cod" ? (codAllowedHere ? "cod" : fallback) : pref === "razorpay" ? (options?.razorpayAvailable ? "razorpay" : fallback) : fallback;

  // The full price, exactly as the order will be priced.
  const quoteKey = active && addressReady && !!method && (!needsMethod || !!chosen) && shippingFresh && !(shipping?.configured && !shipping.deliverable) ? `${linesSignature}|${addressKey}|${method}|${methodId ?? ""}|${discount?.code ?? ""}` : null;
  useEffect(() => {
    if (!quoteKey) return;
    let current = true;
    void quoteAction({ storeSlug, lines: JSON.parse(linesSignature), address: { state: form.state, city: form.city.trim() || undefined, postalCode: form.postalCode.trim() }, paymentMethod: method, shippingMethodId: methodId ?? undefined, discountCode: discount?.code, customerEmail: emailValid ? form.email.trim() : undefined }).then((r) => {
      if (!current) return;
      // The code stopped working (a limit was reached, the bag no longer qualifies): say why and price the bag without it.
      if (!r.ok && isDiscountRefusal(r.details)) {
        setDiscount(null);
        setDiscountError(r.error);
        return;
      }
      setQuoteRes(r.ok ? { key: quoteKey, data: r.data!, error: null, issues: [] } : { key: quoteKey, data: null, error: r.error, issues: issuesOf("details" in r ? r.details : undefined) });
    });
    return () => {
      current = false;
    };
    // The key already covers the cart, the address, the payment method and the delivery option.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, storeSlug]);

  const quoteFresh = quoteKey !== null && quoteRes?.key === quoteKey ? quoteRes : null;
  const quote = quoteFresh?.data ?? null;
  const quoteError = quoteFresh?.error ?? shippingFresh?.error ?? null;
  const issues = submitIssues.length ? submitIssues : (quoteFresh?.issues.length ? quoteFresh.issues : (shippingFresh?.issues ?? []));

  const nameOf = useCallback((slug: string) => lines.find((l) => l.productSlug === slug)?.name ?? "An item", [lines]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const c = customerSchema.safeParse({ fullName: form.fullName, email: form.email, phone: form.phone });
    if (!c.success) for (const i of c.error.issues) next[String(i.path[0])] ??= i.message;
    const a = addressSchema.safeParse({ fullName: form.fullName, phone: form.phone, line1: form.line1, line2: form.line2 || undefined, city: form.city, state: form.state, postalCode: form.postalCode });
    if (!a.success) for (const i of a.error.issues) if (!["fullName", "phone"].includes(String(i.path[0]))) next[String(i.path[0])] ??= i.message;
    if (!form.billingSame) {
      const b = addressSchema.safeParse({ fullName: form.bFullName, phone: form.bPhone, line1: form.bLine1, line2: form.bLine2 || undefined, city: form.bCity, state: form.bState, postalCode: form.bPostalCode });
      if (!b.success) for (const i of b.error.issues) next[`b${String(i.path[0])[0]!.toUpperCase()}${String(i.path[0]).slice(1)}`] ??= i.message;
    }
    if (!method) next.method = "Choose a payment method.";
    if (needsMethod && !chosen) next.shipping = "Choose a delivery option.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || placed.current || !cart || !method) return;
    setFormError(null);
    if (!validate()) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    const body = {
      storeSlug,
      lines: payload,
      customer: { fullName: form.fullName, email: form.email, phone: form.phone },
      shippingAddress: { fullName: form.fullName, phone: form.phone, line1: form.line1, line2: form.line2 || undefined, city: form.city, state: form.state, postalCode: form.postalCode },
      billingSameAsShipping: form.billingSame,
      billingAddress: form.billingSame ? undefined : { fullName: form.bFullName, phone: form.bPhone, line1: form.bLine1, line2: form.bLine2 || undefined, city: form.bCity, state: form.bState, postalCode: form.bPostalCode },
      paymentMethod: method,
      shippingMethodId: chosen?.methodId,
      discountCode: discount?.code,
      cartKey: getCartKey(storeSlug, browserStorage()),
    };
    // The same key for the same cart and details, so a double click or a retry after a dropped connection cannot place two orders.
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newIdempotencyKey() };

    setSubmitting(true);
    setSubmitIssues([]);
    const result = await placeOrderAction({ ...body, idempotencyKey: attempt.current.key });
    if (!result.ok) {
      setSubmitting(false);
      if (isDiscountRefusal(result.details)) {
        // The order was NOT placed: the code no longer works. Show why, take it off, and let the shopper decide.
        setDiscount(null);
        setDiscountError(result.error);
        setFormError("Your discount code could not be used, so the order was not placed. Check the new total, then place it again.");
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      const found = issuesOf(result.details);
      setSubmitIssues(found);
      if (found.length) {
        setFormError("Something in your bag changed. Review the notes below, then try again.");
        void cart.revalidate();
      } else setFormError(result.error);
      return;
    }
    const order = result.data!;
    placed.current = true;
    if (order.accessToken) rememberOrder(storeSlug, { orderNumber: order.orderNumber, token: order.accessToken, placedAt: new Date().toISOString() });
    const token = order.accessToken;
    cart.clear();
    // The next bag is a new one.
    clearCartKey(storeSlug, browserStorage());
    const go = (flag?: string) => router.push(`/orders/${order.orderNumber}${flag ? `?${flag}` : ""}`);
    if (order.paymentMethod === "cod" || !token) return go("placed=1");
    const outcome = await payWithRazorpay({ storeSlug, orderNumber: order.orderNumber, token }, context.store.name);
    go(outcome.status === "paid" ? "placed=1" : `pay=${outcome.status}`);
  }

  if (!cart) return null;
  const hasLines = lines.length > 0;
  const money = (m: number) => formatBagPrice(m, currency);
  const err = (k: string) => errors[k];
  const deliverableBlock = shipping?.configured && !shipping.deliverable;

  return (
    <section className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-[50px]")} {...sfProps}>
      <PageTitle crumbs={[{ label: "Home", href: "/" }, { label: "Your bag", href: "/cart" }, { label: "Checkout" }]} title="Checkout" />

      {notice ? (
        <div className="mt-6">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      {!ready ? (
        <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_25.25rem]" aria-busy="true" aria-label="Loading checkout">
          <div className="h-96 animate-pulse bg-secondary/60" />
          <div className="hidden h-72 animate-pulse bg-secondary/60 lg:block" />
        </div>
      ) : !hasLines ? (
        <div className="flex flex-col items-start gap-6 py-16 md:py-24">
          <p className="text-[1.75rem] leading-tight md:text-[2.25rem]" style={{ fontFamily: "var(--sf-font-heading)" }}>
            Your bag is empty
          </p>
          <Link href="/products" className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[14px] font-medium text-primary-foreground">
            Continue shopping
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid items-start gap-10 pt-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_25.25rem] lg:gap-16">
          <div className="grid gap-12">
            <fieldset className="grid gap-5">
              <legend className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]">Contact</legend>
              <Field label="Full name" htmlFor="co-name" error={err("fullName")}>
                <input id="co-name" className={INPUT} autoComplete="name" value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} aria-invalid={!!err("fullName")} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" htmlFor="co-email" error={err("email")}>
                  <input id="co-email" type="email" inputMode="email" className={INPUT} autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!err("email")} />
                </Field>
                <Field label="Mobile number" htmlFor="co-phone" error={err("phone")}>
                  <input id="co-phone" type="tel" inputMode="tel" className={INPUT} autoComplete="tel" placeholder="10-digit mobile" value={form.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!err("phone")} />
                </Field>
              </div>
              <p className={cn("text-[12px]", MUTED)}>If you leave before paying, we keep your bag and email so you can pick up where you stopped. Nothing is sent to you unless you tick the box below.</p>
              <label className="flex items-start gap-3 text-[13px]">
                <input type="checkbox" checked={remindMe} onChange={(e) => setRemindMe(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span>Email me a reminder about my bag and occasional offers from this store.</span>
              </label>
            </fieldset>

            <fieldset className="grid gap-5">
              <legend className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]">Delivery address</legend>
              <Field label="Address" htmlFor="co-line1" error={err("line1")}>
                <input id="co-line1" className={INPUT} autoComplete="address-line1" value={form.line1} onChange={(e) => set({ line1: e.target.value })} aria-invalid={!!err("line1")} />
              </Field>
              <Field label="Apartment, suite, landmark (optional)" htmlFor="co-line2" error={err("line2")}>
                <input id="co-line2" className={INPUT} autoComplete="address-line2" value={form.line2} onChange={(e) => set({ line2: e.target.value })} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="City" htmlFor="co-city" error={err("city")}>
                  <input id="co-city" className={INPUT} autoComplete="address-level2" value={form.city} onChange={(e) => set({ city: e.target.value })} aria-invalid={!!err("city")} />
                </Field>
                <Field label="State" htmlFor="co-state" error={err("state")}>
                  <select id="co-state" className={INPUT} autoComplete="address-level1" value={form.state} onChange={(e) => set({ state: e.target.value })} aria-invalid={!!err("state")}>
                    <option value="">Select</option>
                    {INDIAN_STATE_NAMES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="PIN code" htmlFor="co-pin" error={err("postalCode")}>
                  <input id="co-pin" inputMode="numeric" maxLength={6} className={INPUT} autoComplete="postal-code" value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, "") })} aria-invalid={!!err("postalCode")} />
                </Field>
              </div>
              <p className={cn("text-[12px]", MUTED)}>Country: India. We deliver within India only.</p>
              <label className="flex items-center gap-3 text-[14px]">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={form.billingSame} onChange={(e) => set({ billingSame: e.target.checked })} />
                Billing address is the same as the delivery address
              </label>
            </fieldset>

            {!form.billingSame ? (
              <fieldset className="grid gap-5">
                <legend className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]">Billing address</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="bo-name" error={err("bFullName")}>
                    <input id="bo-name" className={INPUT} value={form.bFullName} onChange={(e) => set({ bFullName: e.target.value })} />
                  </Field>
                  <Field label="Mobile number" htmlFor="bo-phone" error={err("bPhone")}>
                    <input id="bo-phone" inputMode="tel" className={INPUT} value={form.bPhone} onChange={(e) => set({ bPhone: e.target.value })} />
                  </Field>
                </div>
                <Field label="Address" htmlFor="bo-line1" error={err("bLine1")}>
                  <input id="bo-line1" className={INPUT} value={form.bLine1} onChange={(e) => set({ bLine1: e.target.value })} />
                </Field>
                <Field label="Apartment, suite (optional)" htmlFor="bo-line2" error={err("bLine2")}>
                  <input id="bo-line2" className={INPUT} value={form.bLine2} onChange={(e) => set({ bLine2: e.target.value })} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="City" htmlFor="bo-city" error={err("bCity")}>
                    <input id="bo-city" className={INPUT} value={form.bCity} onChange={(e) => set({ bCity: e.target.value })} />
                  </Field>
                  <Field label="State" htmlFor="bo-state" error={err("bState")}>
                    <select id="bo-state" className={INPUT} value={form.bState} onChange={(e) => set({ bState: e.target.value })}>
                      <option value="">Select</option>
                      {INDIAN_STATE_NAMES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="PIN code" htmlFor="bo-pin" error={err("bPostalCode")}>
                    <input id="bo-pin" inputMode="numeric" maxLength={6} className={INPUT} value={form.bPostalCode} onChange={(e) => set({ bPostalCode: e.target.value.replace(/\D/g, "") })} />
                  </Field>
                </div>
              </fieldset>
            ) : null}

            <fieldset className="grid gap-4" aria-describedby={err("shipping") ? "co-shipping-error" : undefined}>
              <legend className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]">Delivery method</legend>
              {!addressReady ? (
                <p className={cn("text-[14px]", MUTED)}>Enter your state and PIN code to see delivery options.</p>
              ) : shippingBusy && !shipping ? (
                <p role="status" className={cn("text-[14px]", MUTED)}>
                  Finding delivery options…
                </p>
              ) : deliverableBlock ? (
                <Notice tone="error">{shipping?.reason ?? "We do not deliver to this address."}</Notice>
              ) : shipping && !shipping.configured ? (
                <p className={cn("text-[14px]", MUTED)}>Delivery is arranged by the store after you order.</p>
              ) : shipping ? (
                <ul className="grid gap-3">
                  {shipping.options.map((o) => (
                    <li key={o.methodId}>
                      <label className={cn("flex cursor-pointer items-start gap-4 border bg-white px-4 py-4 transition-colors", methodId === o.methodId ? "border-foreground" : "border-border hover:border-foreground/60")}>
                        <input type="radio" name="shipping" className="mt-1 size-4 accent-[var(--primary)]" checked={methodId === o.methodId} onChange={() => setPicked(o.methodId)} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium">{o.name}</span>
                          <span className={cn("block text-[12px]", MUTED)}>
                            {[formatDays(o.estimatedDays) ? `Delivers in ${formatDays(o.estimatedDays)}` : null, o.carrier ? `via ${o.carrier.name}${o.carrier.estimate ? " (estimate)" : ""}` : null].filter(Boolean).join(" · ") || o.kind}
                          </span>
                        </span>
                        <span className="text-[14px] tabular-nums">{o.free || o.chargeMinor === 0 ? "Free" : money(o.chargeMinor)}</span>
                      </label>
                    </li>
                  ))}
                  {shipping.unavailable.map((u) => (
                    <li key={u.methodId} className={cn("border border-dashed border-border px-4 py-3 text-[12px]", MUTED)}>
                      {u.name}: {u.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {err("shipping") ? (
                <p id="co-shipping-error" role="alert" className="text-[12px] text-destructive">
                  {err("shipping")}
                </p>
              ) : null}
            </fieldset>

            <fieldset className="grid gap-4">
              <legend className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]">Payment</legend>
              {options && !options.razorpayAvailable && !codAllowedHere ? (
                <Notice tone="error">This store is not accepting orders right now: no payment method is set up.</Notice>
              ) : (
                <ul className="grid gap-3">
                  {options?.razorpayAvailable ? (
                    <li>
                      <label className={cn("flex cursor-pointer items-start gap-4 border bg-white px-4 py-4", method === "razorpay" ? "border-foreground" : "border-border hover:border-foreground/60")}>
                        <input type="radio" name="payment" className="mt-1 size-4 accent-[var(--primary)]" checked={method === "razorpay"} onChange={() => setPref("razorpay")} />
                        <span className="flex-1">
                          <span className="block text-[14px] font-medium">Pay online</span>
                          <span className={cn("block text-[12px]", MUTED)}>UPI, cards, net banking and wallets, securely through Razorpay.</span>
                        </span>
                      </label>
                    </li>
                  ) : null}
                  {options?.codAvailable ? (
                    <li>
                      <label className={cn("flex items-start gap-4 border bg-white px-4 py-4", codAllowedHere ? "cursor-pointer" : "cursor-not-allowed opacity-60", method === "cod" ? "border-foreground" : "border-border hover:border-foreground/60")}>
                        <input type="radio" name="payment" className="mt-1 size-4 accent-[var(--primary)]" disabled={!codAllowedHere} checked={method === "cod"} onChange={() => setPref("cod")} />
                        <span className="flex-1">
                          <span className="block text-[14px] font-medium">Cash on delivery</span>
                          <span className={cn("block text-[12px]", MUTED)}>
                            {codAllowedHere ? `Pay when your order arrives${options.codFeeMinor ? ` (extra ${money(options.codFeeMinor)})` : ""}.` : codBlockedByMethod ? "Not available with this delivery option." : "Not available for this delivery area."}
                          </span>
                        </span>
                      </label>
                    </li>
                  ) : options?.codUnavailableReason ? (
                    <li className={cn("border border-dashed border-border px-4 py-3 text-[12px]", MUTED)}>Cash on delivery: {options.codUnavailableReason}</li>
                  ) : null}
                </ul>
              )}
              {err("method") ? (
                <p role="alert" className="text-[12px] text-destructive">
                  {err("method")}
                </p>
              ) : null}
            </fieldset>
          </div>

          <aside aria-label="Order summary" className="border border-border bg-white px-6 pb-8 pt-6 sm:px-8 sm:pt-[30px] lg:sticky lg:top-24">
            <h2 className="text-[11px] font-normal uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]" style={{ fontFamily: "var(--sf-font-heading)" }}>
              Order summary
            </h2>
            <ul className="mt-5 grid gap-4">
              {lines.map((line) => {
                const img = publicImageUrl(line.imagePath);
                return (
                  <li key={line.key} className="flex gap-3 text-[13px]">
                    <span className="relative block aspect-[3/4] w-14 shrink-0 overflow-hidden bg-secondary">
                      {img ? <Image src={img} alt="" fill sizes="56px" className="object-cover" /> : null}
                      <span className="absolute right-0 top-0 bg-foreground px-1.5 text-[10px] text-background">{line.quantity}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{line.name}</span>
                      {line.variantTitle ? <span className={cn("block text-[12px]", MUTED)}>{line.variantTitle}</span> : null}
                    </span>
                    <span className="tabular-nums">{money(line.unitPriceMinor * line.quantity)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 border-t border-border pt-6">
              <DiscountBox applied={discount} error={discountError} checking={discountChecking} onApply={(code) => void applyDiscount(code)} onRemove={() => { setDiscount(null); setDiscountError(null); }} money={money} />
            </div>
            <dl className="mt-6 grid gap-[13px] border-t border-border pt-6 text-[14px]">
              <Row label="Subtotal" value={money(quote?.subtotalMinor ?? subtotal)} />
              {discount ? <Row label={`Discount (${discount.code})`} value={`- ${money(quote?.discountMinor ?? discount.discountMinor)}`} /> : null}
              <Row label="Shipping" value={quote ? (quote.shippingMinor === 0 && chosen ? "Free" : money(quote.shippingMinor)) : chosen ? (chosen.chargeMinor === 0 ? "Free" : money(chosen.chargeMinor)) : "Enter address"} />
              {quote && quote.codFeeMinor > 0 ? <Row label="Cash on delivery charge" value={money(quote.codFeeMinor)} /> : null}
              {quote ? <Row label={quote.taxInclusive ? "GST (included)" : "GST"} value={money(quote.taxMinor)} /> : null}
            </dl>
            {quote ? (
              <div className="mt-2">
                <TaxBreakdown tax={quote.tax} currency={currency} />
              </div>
            ) : null}
            <dl className="mt-6">
              <Row strong label="Total" value={quote ? money(quote.totalMinor) : money(Math.max(0, subtotal - (discount?.discountMinor ?? 0)))} />
            </dl>
            {!quote ? <p className={cn("mt-3 text-[11px]", MUTED)}>The final total, with delivery and GST, appears once your address and payment method are chosen.</p> : null}

            {quoteError && !issues.length ? (
              <div className="mt-5">
                <Notice tone="error">{quoteError}</Notice>
              </div>
            ) : null}
            {issues.length ? (
              <ul className="mt-5 grid gap-2 border border-destructive/40 bg-destructive/5 px-4 py-3 text-[12px] text-destructive" role="alert">
                {issues.map((i) => (
                  <li key={`${i.productSlug}:${i.variantId}:${i.code}`}>{(ISSUE_TEXT[i.code] ?? (() => "An item needs attention."))(nameOf(i.productSlug), i)}</li>
                ))}
                <li>
                  <button type="button" className="underline underline-offset-4" onClick={() => {
                      setSubmitIssues([]);
                      void cart.revalidate();
                    }}>
                    Update my bag
                  </button>
                </li>
              </ul>
            ) : null}
            {formError ? (
              <div className="mt-5">
                <Notice tone="error">{formError}</Notice>
              </div>
            ) : null}

            <button type="submit" disabled={submitting || deliverableBlock || (!!options && !options.razorpayAvailable && !codAllowedHere)} className={cn(PRIMARY_BUTTON, "mt-6")}>
              {submitting ? "Placing your order…" : method === "cod" ? "Place order" : "Pay now"}
            </button>
            <p className={cn("mt-3 text-center text-[11px]", MUTED)}>Prices are confirmed by the store when you place the order.</p>
          </aside>
        </form>
      )}
    </section>
  );
}
