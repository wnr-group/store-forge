import type { Metadata } from "next";
import { PagesManager } from "@/components/pages/pages-manager";
import { PageHeader } from "@/components/shared/page-header";
import { canManageStore } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { storefrontUrl } from "@/lib/tenant/host";
import { listPages } from "@/services/pages.service";

export const metadata: Metadata = { title: "Pages" };

/** Online Store > Pages: content pages such as About and Contact, shown at the root of the store's address. */
export default async function PagesPage() {
  const { active, store } = await requireWorkspaceCan("dashboard:view");
  const pages = await listPages();
  return (
    <>
      <PageHeader title="Pages" description="Write the pages your customers read, like About, Contact and your policies. Add them to your menu in Navigation." />
      <PagesManager pages={pages} canManage={canManageStore(active)} storeUrl={store ? storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId) : null} />
    </>
  );
}
