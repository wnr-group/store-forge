import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CartDetailActions } from "@/components/marketing/cart-detail-actions";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManageMarketing } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format-date";
import { CART_STATUS } from "@/lib/marketing/labels";
import { formatMoney } from "@/lib/money";
import { storefrontUrl } from "@/lib/tenant/host";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getAbandonedCart } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Saved cart" };

export default async function AbandonedCartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { active, store } = await requireWorkspaceCan("marketing:view");
  const cart = await getAbandonedCart(id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!cart) notFound();

  const timeZone = store?.timezone ?? "Asia/Kolkata";
  const money = (m: number) => formatMoney(m, cart.currency);
  const s = CART_STATUS[cart.status];
  // The API gives the path; the address of the store is this app's to know.
  const token = cart.recoveryPath?.split("recover=")[1];
  const origin = store ? storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId) : null;
  const link = token && origin ? `${origin}/cart?recover=${token}` : null;
  const canManage = canManageMarketing(active);

  return (
    <>
      <Link href={ROUTES.abandonedCarts} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Abandoned carts
      </Link>
      <PageHeader title={cart.customerName || cart.email || "Saved cart"} description={cart.customerName && cart.email ? cart.email : undefined} actions={<CartDetailActions id={cart.id} link={link} canManage={canManage} />} />
      <div className="grid max-w-4xl gap-6">
        <SectionCard title="Cart" description="The items as they were when the shopper last touched the bag. Prices are re-checked when the bag is restored.">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                {cart.status === "recovered" && cart.recoveredOrderNumber ? <span className="ml-2 text-xs text-muted-foreground">Order #{cart.recoveredOrderNumber}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last activity</dt>
              <dd className="mt-1">{formatDateTime(new Date(cart.lastActivityAt), timeZone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Abandoned since</dt>
              <dd className="mt-1">{cart.abandonedAt ? formatDateTime(new Date(cart.abandonedAt), timeZone) : "Not yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Recovery link opened</dt>
              <dd className="mt-1">{cart.recoveryClicks} time{cart.recoveryClicks === 1 ? "" : "s"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="mt-1">{cart.phone ?? "Not given"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Agreed to be contacted</dt>
              <dd className="mt-1">{cart.marketingConsent ? "Yes" : "No"}</dd>
            </div>
          </dl>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.items.map((i, idx) => (
                  <TableRow key={`${i.productSlug ?? i.name}-${i.variantId ?? ""}-${idx}`}>
                    <TableCell>{i.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(i.unitPriceMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(i.unitPriceMinor * i.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Cart value</TableCell>
                  <TableCell className="text-right tabular-nums">{money(cart.cartValueMinor)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </SectionCard>

        <SectionCard title="Recovery link" description="Opening it puts these items back in the shopper's bag with today's prices. Nothing is sent for you: share it yourself only with a shopper who agreed to be contacted.">
          {link ? (
            <p className="break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">{link}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{cart.status === "recovered" ? "This shopper came back and bought, so there is nothing left to recover." : cart.status === "expired" ? "The recovery window has passed, so the link no longer works." : "A link cannot be made right now."}</p>
          )}
          {!cart.canContact ? <p className="text-xs text-muted-foreground">This shopper did not agree to be contacted about their bag. Do not send them marketing.</p> : null}
        </SectionCard>
      </div>
    </>
  );
}
