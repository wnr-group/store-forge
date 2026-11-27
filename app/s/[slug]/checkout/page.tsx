import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { readCustomerToken } from "@/lib/customer/session";
import { checkoutDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** Checkout. The page holds no store data: the bag comes from the browser and every price from the API. */

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: Params) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  // Browsing, the bag and product pages are open to everyone; checkout is where an account is asked for. The bag lives in this
  // browser, so it is still there when the shopper comes back from signing in.
  if (!(await readCustomerToken(slug))) redirect("/account/login?next=/checkout");
  const frame = (await getPublishedFrame(slug)) ?? { layout: { theme: null, groups: {} }, collections: [] };
  return <PublishedView store={store} frame={frame} document={checkoutDocument()} />;
}
