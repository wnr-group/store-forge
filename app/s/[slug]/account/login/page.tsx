import type { Metadata } from "next";
import { renderAccountPage } from "@/components/storefront/account/render-account-page";

/** Shopper sign-in. Not the store owner's /login: that one is the dashboard's. */

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string | string[] }> };

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function ShopperLoginPage({ params, searchParams }: Params) {
  const [{ slug }, { next }] = await Promise.all([params, searchParams]);
  return renderAccountPage(slug, "login", { next, path: "/account/login" });
}
