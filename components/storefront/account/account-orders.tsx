"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cancelAccountOrderAction, getAccountOrderAction, listOrdersAction } from "@/app/s/[slug]/account/actions";
import type { AccountOrderApi, AccountOrderSummaryApi } from "@/lib/api/endpoints/customer-account-api";
import { formatBagPrice } from "@/lib/cart/format";
import { tokenFor } from "@/lib/checkout/my-orders";
import { buildTimeline, trackingLabel, type TimelineStep } from "@/lib/customer/order-timeline";
import { cn } from "@/lib/utils";
import { formatDays, labelOf, MUTED, Notice, PAYMENT_LABELS, Row, SECONDARY_BUTTON, TaxBreakdown } from "../checkout/checkout-ui";
import { dateOnly, dateTime, Skeleton, useSignInRedirect } from "./account-shell";

const BADGE = "border border-foreground px-3 py-1 text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.14em)]";

/** The shopper's orders in this store, newest first, ten to a page. */
export function AccountOrders({ storeSlug }: { storeSlug: string }) {
  const signIn = useSignInRedirect();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AccountOrderSummaryApi[]; totalPages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void listOrdersAction({ storeSlug, page }).then((r) => {
      if (!live || signIn(r)) return;
      if (r.ok && r.data) setData({ items: r.data.items, totalPages: r.data.meta.totalPages });
      else setError(r.ok ? "Your orders could not be loaded." : r.error);
    });
    return () => {
      live = false;
    };
  }, [storeSlug, page, signIn]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Skeleton label="Loading your orders" />;
  if (data.items.length === 0)
    return (
      <div className="grid justify-items-start gap-4">
        <p className="text-[17px]">You have not placed an order yet.</p>
        <p className={cn("max-w-md text-[16px] leading-7", MUTED)}>When you do, it shows up here with its delivery progress.</p>
        <Link href="/products" className="text-[14px] font-medium [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.16em)] underline underline-offset-4">
          Start shopping
        </Link>
      </div>
    );

  return (
    <div className="grid gap-6">
      <ul className="border-b border-border">
        {data.items.map((o) => (
          <li key={o.orderNumber} className="border-t border-border">
            <Link href={`/account/orders/${o.orderNumber}`} className="grid gap-x-6 gap-y-1 py-5 text-[16px] hover:bg-secondary/40 md:grid-cols-[8rem_1fr_9rem_8rem] md:items-center">
              <span className="font-medium">Order #{o.orderNumber}</span>
              <span className={MUTED}>
                {dateOnly(o.placedAt)} · {o.firstItemName ?? "Items"}
                {o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ""}
              </span>
              <span>
                <span className={BADGE}>{trackingLabel(o.status)}</span>
              </span>
              <span className="tabular-nums md:text-right">{formatBagPrice(o.totalMinor, o.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-[14px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.14em)]">
          <button type="button" className="underline underline-offset-4 disabled:no-underline disabled:opacity-40" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            Newer
          </button>
          <span className={MUTED}>
            Page {page} of {data.totalPages}
          </span>
          <button type="button" className="underline underline-offset-4 disabled:no-underline disabled:opacity-40" onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}>
            Older
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** One order: the tracking timeline, parcels (courier and tracking number), items, payment and delivery address. */
export function AccountOrderDetail({ storeSlug, orderNumber }: { storeSlug: string; storeName: string; orderNumber: number }) {
  const signIn = useSignInRedirect();
  const [order, setOrder] = useState<AccountOrderApi | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ok">("loading");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(orderNumber)) return setState("missing");
    const r = await getAccountOrderAction({ storeSlug, orderNumber });
    if (signIn(r)) return;
    if (r.ok && r.data) {
      setOrder(r.data);
      setState("ok");
    } else if (!r.ok && r.code === "NOT_FOUND") setState("missing");
    else {
      setError(r.ok ? "This order could not be loaded." : r.error);
      setState("error");
    }
  }, [storeSlug, orderNumber, signIn]);

  useEffect(() => {
    void load();
  }, [load]);

  // The store may update the order while this page is open; look again now and then (and when the tab comes back).
  useEffect(() => {
    const again = () => document.visibilityState === "visible" && void load();
    const timer = window.setInterval(again, 60_000);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
    };
  }, [load]);

  async function cancel() {
    if (cancelling || !window.confirm("Cancel this order?")) return;
    setCancelling(true);
    setMessage(null);
    const r = await cancelAccountOrderAction({ storeSlug, orderNumber });
    setCancelling(false);
    if (signIn(r)) return;
    if (r.ok && r.data) {
      setOrder(r.data);
      setMessage({ tone: "success", text: "Your order was cancelled." });
    } else setMessage({ tone: "error", text: r.ok ? "The order could not be cancelled." : r.error });
  }

  if (state === "loading") return <Skeleton label="Loading your order" className="h-80" />;
  if (state === "missing")
    return (
      <div className="grid justify-items-start gap-4">
        <p className="text-[17px]">We could not find this order in your account.</p>
        <Link href="/account/orders" className="text-[14px] font-medium [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.16em)] underline underline-offset-4">
          Your orders
        </Link>
      </div>
    );
  if (state === "error" || !order) return <Notice tone="error">{error ?? "This order could not be loaded."}</Notice>;

  const money = (m: number) => formatBagPrice(m, order.currency);
  const a = order.shippingAddress;
  const canCancel = ["pending_payment", "confirmed"].includes(order.status) && ["unpaid", "pending_collection"].includes(order.paymentStatus);
  const hasToken = !!tokenFor(storeSlug, order.orderNumber);
  const awaitingPayment = order.status === "pending_payment" && order.paymentMethod === "razorpay";

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_25.25rem] lg:gap-16">
      <div className="grid gap-10">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
          <span className={BADGE}>{trackingLabel(order.status)}</span>
          <span className={MUTED}>{labelOf(PAYMENT_LABELS, order.paymentStatus)}</span>
          <span className={MUTED}>Placed {dateTime(order.placedAt)}</span>
        </div>

        {awaitingPayment ? (
          <Notice>
            This order is waiting for payment.{" "}
            {hasToken ? (
              <Link href={`/orders/${order.orderNumber}`} className="underline underline-offset-4">
                Pay now
              </Link>
            ) : (
              "Open it on the device you checked out from to pay, or contact the store with your order number."
            )}
          </Notice>
        ) : null}

        <div>
          <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Order tracking</h2>
          <OrderTimeline steps={buildTimeline(order)} />
        </div>

        {order.shipments.length ? (
          <div className="grid gap-4">
            <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Shipment</h2>
            {order.shipments.map((s, idx) => (
              <div key={`${s.awb ?? "parcel"}-${idx}`} className="border border-border bg-white rounded-[var(--pg-panel-radius,0px)] shadow-[var(--pg-panel-shadow,none)] p-5 text-[16px]">
                <dl className="grid gap-1.5">
                  {s.courierName ? <Row label="Shipping provider" value={s.courierName} /> : null}
                  {s.awb ? <Row label="Tracking number" value={<span className="font-mono">{s.awb}</span>} /> : null}
                  {s.estimatedDelivery ? <Row label="Expected by" value={dateOnly(s.estimatedDelivery)} /> : null}
                </dl>
                <p className={cn("mt-3 text-[14px]", MUTED)}>{s.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
                {s.trackingUrl ? (
                  <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[14px] font-medium [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.14em)] underline underline-offset-4">
                    Track with the courier
                  </a>
                ) : null}
                {s.events.length ? (
                  <ol className="mt-4 grid gap-3 border-l border-border pl-4">
                    {s.events.map((e, i) => (
                      <li key={i} className="text-[15px]">
                        <p>{e.description || labelOf({}, e.status)}</p>
                        <p className={cn("text-[13px]", MUTED)}>{[e.location, e.occurredAt ? dateTime(e.occurredAt) : null].filter(Boolean).join(" · ")}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Items</h2>
          <ul className="mt-4 border-b border-border">
            {order.items.map((i, idx) => (
              <li key={`${i.name}-${idx}`} className="flex justify-between gap-4 border-t border-border py-4 text-[16px]">
                <span>
                  {i.productSlug ? (
                    <Link href={`/products/${i.productSlug}`} className="underline-offset-4 hover:underline">
                      {i.name}
                    </Link>
                  ) : (
                    i.name
                  )}{" "}
                  <span className={MUTED}>× {i.quantity}</span>
                </span>
                <span className="tabular-nums">{money(i.totalMinor)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-1 text-[16px]">
          <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Delivery address</h2>
          <p className="mt-3">{a.fullName}</p>
          <p>{[a.line1, a.line2].filter(Boolean).join(", ")}</p>
          <p>
            {a.city}, {a.state} {a.postalCode}
          </p>
          <p className={MUTED}>{a.phone}</p>
          {order.shippingMethodName ? <p className={cn("mt-2", MUTED)}>{[order.shippingMethodName, order.shippingDays ? formatDays(order.shippingDays) : null].filter(Boolean).join(" · ")}</p> : null}
        </div>
      </div>

      <aside aria-label="Order summary" className="border border-border bg-white rounded-[var(--pg-panel-radius,0px)] shadow-[var(--pg-panel-shadow,none)] px-6 pb-9 pt-7 sm:px-9 sm:pt-[30px]">
        <h2 className="text-[13px] font-normal [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)] text-[color:var(--sf-color-muted)]">Payment</h2>
        <dl className="mt-5 grid gap-[13px] text-[16px]">
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
        <p className={cn("mt-3 text-[14px]", MUTED)}>
          {order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment (Razorpay)"} · {labelOf(PAYMENT_LABELS, order.paymentStatus)}
        </p>
        {canCancel ? (
          <button type="button" className={cn(SECONDARY_BUTTON, "mt-6")} onClick={cancel} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        ) : order.paymentStatus === "paid" && ["confirmed", "processing"].includes(order.status) ? (
          <p className={cn("mt-6 text-[14px]", MUTED)}>A paid order is cancelled by the store, which will refund it. Contact the store with your order number.</p>
        ) : null}
      </aside>
    </div>
  );
}

/** The status steps with the time each was reached. Reads top to bottom on a phone and on a desktop alike. */
export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  const items = useMemo(() => steps, [steps]);
  return (
    <ol className="mt-5 grid" aria-label="Order progress">
      {items.map((s, i) => {
        const last = i === items.length - 1;
        const done = s.state === "done";
        const current = s.state === "current";
        const stopped = s.state === "stopped";
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {!last ? <span aria-hidden className={cn("absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px", done ? "bg-foreground" : "bg-border")} /> : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[13px]",
                done && "border-foreground bg-foreground text-background",
                current && "border-foreground bg-background ring-4 ring-foreground/15",
                stopped && "border-destructive bg-destructive text-white",
                s.state === "upcoming" && "border-border bg-background",
              )}
            >
              {done ? "✓" : stopped ? "×" : null}
            </span>
            <div className="grid gap-0.5 text-[16px]">
              <p className={cn(s.state === "upcoming" ? MUTED : "font-medium", stopped && "text-destructive")}>
                {s.label}
                <span className="sr-only">{done ? " (done)" : current ? " (current)" : stopped ? " (ended)" : " (not yet)"}</span>
              </p>
              <p className={cn("text-[14px]", MUTED)}>{s.at ? dateTime(s.at) : s.state === "upcoming" ? "Pending" : current ? "In progress" : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
