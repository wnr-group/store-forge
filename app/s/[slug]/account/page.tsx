import type { Metadata } from "next";
import { renderAccountPage } from "@/components/storefront/account/render-account-page";

/** The shopper's account overview: details and password. Needs a signed-in shopper. */

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage({ params }: Params) {
  const { slug } = await params;
  return renderAccountPage(slug, "home", { path: "/account" });
}
