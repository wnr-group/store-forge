import type { Metadata } from "next";
import { renderAccountPage } from "@/components/storefront/account/render-account-page";

/** Shopper sign-up for this store. There is no public store-owner registration here: owners are onboarded through /signup on the main site. */

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string | string[] }> };

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function ShopperRegisterPage({ params, searchParams }: Params) {
  const [{ slug }, { next }] = await Promise.all([params, searchParams]);
  return renderAccountPage(slug, "register", { next, path: "/account/register" });
}
