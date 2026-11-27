import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderAccountPage } from "@/components/storefront/account/render-account-page";

/** One order with its tracking timeline. Someone else's order number answers "not found" from the API. */

type Params = { params: Promise<{ slug: string; orderNumber: string }> };

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function AccountOrderPage({ params }: Params) {
  const { slug, orderNumber } = await params;
  if (!/^[1-9]\d{0,9}$/.test(orderNumber)) notFound();
  return renderAccountPage(slug, "order", { orderNumber: Number(orderNumber), path: `/account/orders/${orderNumber}` });
}
