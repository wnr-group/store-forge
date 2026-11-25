"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cancelOrderAction, getOrderAction } from "@/app/s/[slug]/checkout/actions";
import type { PublicOrderApi } from "@/lib/api/endpoints/checkout-api";
import { formatBagPrice } from "@/lib/cart/format";
import { readMyOrders, tokenFor, type MyOrder } from "@/lib/checkout/my-orders";
import { purchaseEventId } from "@/lib/tracking/events";
import { markPurchaseTracked, wasPurchaseTracked } from "@/lib/tracking/purchase-guard";
import { cn } from "@/lib/utils";
import type { SectionProps } from "../engine/looks";
import { formatDays, labelOf, MUTED, Notice, PageTitle, PAYMENT_LABELS, PRIMARY_BUTTON, Row, SECONDARY_BUTTON, SHELL, STATUS_LABELS, TaxBreakdown } from "./checkout-ui";
import { useTracker } from "../tracking/tracking-provider";
import { payWithRazorpay } from "./razorpay";

/** Order statuses that count as a sale. */
const SALE_STATUSES = new Set(["confirmed", "processing", "ready_to_ship", "shipped", "out_for_delivery", "delivered"]);

const browserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const dateTime = (iso: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

type Load = { state: "loading" } | { state: "missing" } | { state: "error"; message: string } | { state: "ok"; order: PublicOrderApi };

/** One order, for the shopper who placed it: opened with the order token this browser saved at checkout. */
export function OrderPageSection({ context, sectionId }: SectionProps) {
  const storeSlug = context.store.slug;
  const orderNumber = Number(context.resource?.orderNumber);
  // The page is rendered once for every shopper, so the "just placed" / "payment closed" flags are read in the browser.
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [busy, setBusy] = useState<"cancel" | "pay" | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const token = useRef<string | null>(null);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  // A purchase is reported once, and only for an order this visit placed or paid (never for an old order opened again).
  const { track } = useTracker();
  const sawUnpaid = useRef(false);
  useEffect(() => {
    if (isPreview || load.state !== "ok") return;
    const o = load.order;
    if (o.status === "pending_payment") sawUnpaid.current = true;
    if (!SALE_STATUSES.has(o.status) || (!params.get("placed") && !sawUnpaid.current)) return;
    if (wasPurchaseTracked(browserStorage(), storeSlug, o.orderNumber)) return;
    const items = o.items.map((i) => ({ id: i.productSlug ?? i.sku ?? i.name, name: i.name, priceMinor: i.unitPriceMinor, quantity: i.quantity }));
    const sent = track({ type: "purchase", transactionId: String(o.orderNumber), eventId: purchaseEventId(String(o.orderNumber)), currency: o.currency, items, discountMinor: o.discountMinor, shippingMinor: o.shippingMinor + o.codFeeMinor, taxMinor: o.taxMinor });
    if (sent) markPurchaseTracked(browserStorage(), storeSlug, o.orderNumber);
  }, [load, params, track, storeSlug, isPreview]);

  const refresh = useCallback(async () => {
    if (!token.current) return;
    const r = await getOrderAction({ storeSlug, orderNumber, token: token.current });
    if (r.ok && r.data) setLoad({ state: "ok", order: r.data });
    else setLoad(r.ok || r.code === "NOT_FOUND" ? { state: "missing" } : { state: "error", message: r.error });
  }, [storeSlug, orderNumber]);

  useEffect(() => {
    if (isPreview || !Number.isInteger(orderNumber)) return;
    token.current = tokenFor(storeSlug, orderNumber);
    if (!token.current) {
      setLoad({ state: "missing" });
      return;
    }
    void refresh();
  }, [storeSlug, orderNumber, refresh, isPreview]);

  // After "Pay now" the webhook may land a moment after the browser; look again once while the order is still unpaid.
  const unpaid = load.state === "ok" && load.order.status === "pending_payment";
  useEffect(() => {
    if (!unpaid || !params.get("placed")) return;
    const t = window.setTimeout(() => void refresh(), 4000);
    return () => window.clearTimeout(t);
  }, [unpaid, params, refresh]);

  const payFlag = params.get("pay");
  const flash: { tone: "info" | "error"; text: string } | null = payFlag === "dismissed" ? { tone: "info", text: "Your order is saved but not paid yet. Pay now to confirm it before the held stock is released." } : payFlag === "failed" || payFlag === "error" ? { tone: "error", text: "Your payment did not go through. Your order is saved; you can try paying again." } : null;

  const pay = async () => {
    if (!token.current || busy) return;
    setBusy("pay");
    setMessage(null);
    const outcome = await payWithRazorpay({ storeSlug, orderNumber, token: token.current }, context.store.name);
    setBusy(null);
    if (outcome.status === "paid") {
      setLoad({ state: "ok", order: outcome.order });
      setMessage({ tone: "success", text: "Payment received. Thank you!" });
    } else if (outcome.status === "dismissed") setMessage({ tone: "info", text: "Payment window closed. You can pay any time before the held stock is released." });
    else setMessage({ tone: "error", text: outcome.message });
    void refresh();
  };

  const cancel = async () => {
    if (!token.current || busy || !window.confirm("Cancel this order?")) return;
    setBusy("cancel");
    const r = await cancelOrderAction({ storeSlug, orderNumber, token: token.current });
    setBusy(null);
    if (r.ok && r.data) {
      setLoad({ state: "ok", order: r.data });
      setMessage({ tone: "success", text: "Your order was cancelled." });
    } else setMessage({ tone: "error", text: r.ok ? "The order could not be cancelled." : r.error });
  };

  return (
    <section className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-[50px]")} {...sfProps}>
      <PageTitle crumbs={[{ label: "Home", href: "/" }, { label: "Your orders", href: "/orders" }, { label: `Order #${orderNumber}` }]} title={`Order #${Number.isInteger(orderNumber) ? orderNumber : ""}`} />
      <div className="grid gap-8 pt-10 md:pt-12">
        {(message ?? flash) ? <Notice tone={(message ?? flash)!.tone}>{(message ?? flash)!.text}</Notice> : null}
        {load.state === "loading" ? (
          <div className="h-64 animate-pulse bg-secondary/60" aria-busy="true" aria-label="Loading your order" />
        ) : load.state === "missing" ? (
          <div className="grid gap-4">
            <p className="text-[15px]">We could not find this order in this browser.</p>
            <p className={cn("max-w-md text-[14px] leading-7", MUTED)}>Orders can only be opened on the device they were placed from. If you need help with an order, contact the store with your order number.</p>
            <Link href="/orders" className="text-[12px] font-medium uppercase tracking-[0.16em] underline underline-offset-4">
              Your orders
            </Link>
          </div>
        ) : load.state === "error" ? (
          <Notice tone="error">{load.message}</Notice>
        ) : (
          <OrderBody order={load.order} busy={busy} onPay={pay} onCancel={cancel} placed={!!params.get("placed")} />
        )}
      </div>
    </section>
  );
}

function OrderBody({ order, busy, onPay, onCancel, placed }: { order: PublicOrderApi; busy: "cancel" | "pay" | null; onPay: () => void; onCancel: () => void; placed: boolean }) {
  const money = (m: number) => formatBagPrice(m, order.currency);
  const canPay = order.paymentMethod === "razorpay" && order.status === "pending_payment";
  const canCancel = order.status === "pending_payment" || (order.paymentMethod === "cod" && ["confirmed", "processing"].includes(order.status) && order.fulfillmentStatus === "unfulfilled");
  const a = order.shippingAddress;
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_25.25rem] lg:gap-16">
      <div className="grid gap-10">
        {placed && order.status !== "cancelled" ? <Notice tone="success">{order.paymentMethod === "cod" ? "Thank you! Your order is placed. Pay in cash when it arrives." : order.status === "pending_payment" ? "Your order is placed. Complete the payment to confirm it." : "Thank you! Your payment was received and your order is confirmed."}</Notice> : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          <span className="border border-foreground px-3 py-1 text-[11px] uppercase tracking-[0.14em]">{labelOf(STATUS_LABELS, order.status)}</span>
          <span className={MUTED}>{labelOf(PAYMENT_LABELS, order.paymentStatus)}</span>
          <span className={MUTED}>Placed {dateTime(order.placedAt)}</span>
        </div>

        {canPay ? (
          <div className="grid gap-3 border border-border bg-white p-5 sm:max-w-md">
            <p className="text-[14px]">This order is waiting for payment{order.reservationExpiresAt ? `. Your items are held until ${dateTime(order.reservationExpiresAt)}.` : "."}</p>
            <button type="button" className={PRIMARY_BUTTON} onClick={onPay} disabled={busy !== null}>
              {busy === "pay" ? "Opening payment…" : `Pay ${money(order.totalMinor)}`}
            </button>
          </div>
        ) : null}

        <div>
          <h2 className={cn("text-[11px] uppercase tracking-[0.2em]", MUTED)}>Items</h2>
          <ul className="mt-4 border-b border-border">
            {order.items.map((i, idx) => (
              <li key={`${i.name}-${idx}`} className="flex justify-between gap-4 border-t border-border py-4 text-[14px]">
                <span>
                  {i.name} <span className={MUTED}>× {i.quantity}</span>
                </span>
                <span className="tabular-nums">{money(i.totalMinor)}</span>
              </li>
            ))}
          </ul>
        </div>

        {order.shipments.length ? (
          <div className="grid gap-6">
            <h2 className={cn("text-[11px] uppercase tracking-[0.2em]", MUTED)}>Shipments</h2>
            {order.shipments.map((s, idx) => (
              <div key={`${s.awb ?? "shipment"}-${idx}`} className="border border-border bg-white p-5 text-[14px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{labelOf(STATUS_LABELS, s.status)}</span>
                  <span className={MUTED}>{[s.courierName, s.awb ? `AWB ${s.awb}` : null].filter(Boolean).join(" · ")}</span>
                </div>
                {s.estimatedDelivery ? <p className={cn("mt-1 text-[12px]", MUTED)}>Estimated delivery {dateTime(s.estimatedDelivery)}</p> : null}
                <p className={cn("mt-1 text-[12px]", MUTED)}>{s.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
                {s.trackingUrl ? (
                  <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[12px] font-medium uppercase tracking-[0.14em] underline underline-offset-4">
                    Track with the courier
                  </a>
                ) : null}
                {s.events.length ? (
                  <ol className="mt-4 grid gap-3 border-l border-border pl-4">
                    {s.events.map((e, i) => (
                      <li key={i} className="text-[13px]">
                        <p>{e.description || labelOf(STATUS_LABELS, e.status)}</p>
                        <p className={cn("text-[11px]", MUTED)}>{[e.location, e.occurredAt ? dateTime(e.occurredAt) : null].filter(Boolean).join(" · ")}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-1 text-[14px]">
          <h2 className={cn("text-[11px] uppercase tracking-[0.2em]", MUTED)}>Delivery address</h2>
          <p className="mt-3">{a.fullName}</p>
          <p>{[a.line1, a.line2].filter(Boolean).join(", ")}</p>
          <p>
            {a.city}, {a.state} {a.postalCode}
          </p>
          <p className={MUTED}>{a.phone}</p>
          {order.shippingMethodName ? <p className={cn("mt-2", MUTED)}>{[order.shippingMethodName, order.shippingDays ? `${formatDays(order.shippingDays)}` : null].filter(Boolean).join(" · ")}</p> : null}
        </div>
      </div>

      <aside aria-label="Order summary" className="border border-border bg-white px-6 pb-8 pt-6 sm:px-8 sm:pt-[30px]">
        <h2 className="text-[11px] font-normal uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]">Summary</h2>
        <dl className="mt-5 grid gap-[13px] text-[14px]">
          <Row label="Subtotal" value={money(order.subtotalMinor)} />
          {order.discountMinor > 0 ? <Row label="Discount" value={`- ${money(order.discountMinor)}`} /> : null}
          <Row label="Shipping" value={order.shippingMinor === 0 ? "Free" : money(order.shippingMinor)} />
          {order.codFeeMinor > 0 ? <Row label="Cash on delivery charge" value={money(order.codFeeMinor)} /> : null}
          <Row label={order.taxInclusive ? "GST (included)" : "GST"} value={money(order.taxMinor)} />
        </dl>
        <div className="mt-2">
          <TaxBreakdown tax={order.tax} currency={order.currency} />
        </div>
        <dl className="mt-6">
          <Row strong label="Total" value={money(order.totalMinor)} />
        </dl>
        <p className={cn("mt-3 text-[12px]", MUTED)}>{order.paymentMethod === "cod" ? "Cash on delivery" : "Paid online with Razorpay"}</p>
        {canCancel ? (
          <button type="button" className={cn(SECONDARY_BUTTON, "mt-6")} onClick={onCancel} disabled={busy !== null}>
            {busy === "cancel" ? "Cancelling…" : "Cancel order"}
          </button>
        ) : order.status === "confirmed" && order.paymentMethod === "razorpay" ? (
          <p className={cn("mt-6 text-[12px]", MUTED)}>A paid order is cancelled by the store, which will refund it. Contact the store with your order number.</p>
        ) : null}
      </aside>
    </div>
  );
}

/** The orders this browser placed in this store, newest first. Each is read with its own saved token. */
export function OrdersListSection({ context, sectionId }: SectionProps) {
  const storeSlug = context.store.slug;
  const [rows, setRows] = useState<{ ref: MyOrder; order: PublicOrderApi | null }[] | null>(null);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  useEffect(() => {
    if (isPreview) return;
    let live = true;
    const mine = readMyOrders(storeSlug).slice(0, 10);
    void Promise.all(mine.map(async (ref) => ({ ref, order: await getOrderAction({ storeSlug, orderNumber: ref.orderNumber, token: ref.token }).then((r) => (r.ok ? (r.data ?? null) : null)) }))).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [storeSlug, isPreview]);

  return (
    <section className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-[50px]")} {...sfProps}>
      <PageTitle crumbs={[{ label: "Home", href: "/" }, { label: "Your orders" }]} title="Your orders" />
      <div className="pt-10 md:pt-12">
        {rows === null ? (
          <div className="h-40 animate-pulse bg-secondary/60" aria-busy="true" aria-label="Loading your orders" />
        ) : rows.length === 0 ? (
          <div className="grid gap-4">
            <p className="text-[15px]">No orders from this browser yet.</p>
            <p className={cn("max-w-md text-[14px] leading-7", MUTED)}>Orders you place here are listed on this device so you can track them.</p>
            <Link href="/products" className="text-[12px] font-medium uppercase tracking-[0.16em] underline underline-offset-4">
              Continue shopping
            </Link>
          </div>
        ) : (
          <ul className="border-b border-border">
            {rows.map(({ ref, order }) => (
              <li key={ref.orderNumber} className="border-t border-border">
                <Link href={`/orders/${ref.orderNumber}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-5 text-[14px] hover:bg-secondary/40">
                  <span className="font-medium">Order #{ref.orderNumber}</span>
                  <span className={MUTED}>{order ? dateTime(order.placedAt) : dateTime(ref.placedAt)}</span>
                  <span>{order ? labelOf(STATUS_LABELS, order.status) : "Unavailable"}</span>
                  <span className="tabular-nums">{order ? formatBagPrice(order.totalMinor, order.currency) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
