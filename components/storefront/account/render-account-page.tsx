import { notFound, redirect } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { readCustomerToken, safeNext } from "@/lib/customer/session";
import { accountDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/**
 * One page of the shopper's account area. The page itself holds no shopper data: what it shows is read in the browser through
 * server actions with the shopper's own session. What IS decided here, before anything renders, is whether to show the page at
 * all: a visitor with no session is sent to sign in (and back afterwards), and a signed-in visitor has no use for the sign-in
 * and sign-up pages.
 */
export async function renderAccountPage(
  slug: string,
  view: "login" | "register" | "home" | "orders" | "order" | "addresses",
  options: { orderNumber?: number; next?: string | string[]; path: string },
) {
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();

  const signedIn = !!(await readCustomerToken(slug));
  const next = safeNext(options.next);
  if (view === "login" || view === "register") {
    if (signedIn) redirect(next);
  } else if (!signedIn) {
    redirect(`/account/login?next=${encodeURIComponent(options.path)}`);
  }

  const frame = (await getPublishedFrame(slug)) ?? { layout: { theme: null, groups: {} }, collections: [] };
  return <PublishedView store={store} frame={frame} document={accountDocument()} resource={{ view, next, orderNumber: options.orderNumber }} />;
}
