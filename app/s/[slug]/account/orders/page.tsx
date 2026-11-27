import type { Metadata } from "next";
import { renderAccountPage } from "@/components/storefront/account/render-account-page";

/** The shopper's order history. Needs a signed-in shopper; the API lists only orders placed from their own account. */

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default async function AccountOrdersPage({ params }: Params) {
  const { slug } = await params;
  return renderAccountPage(slug, "orders", { path: "/account/orders" });
}
