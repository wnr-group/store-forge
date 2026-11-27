import type { Metadata } from "next";
import { renderAccountPage } from "@/components/storefront/account/render-account-page";

/** The shopper's saved delivery addresses. Needs a signed-in shopper. */

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function AccountAddressesPage({ params }: Params) {
  const { slug } = await params;
  return renderAccountPage(slug, "addresses", { path: "/account/addresses" });
}
