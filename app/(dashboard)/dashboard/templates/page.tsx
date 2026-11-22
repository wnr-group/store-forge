import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ThemeStore } from "@/components/themes/theme-store";
import { ThemeQueryProvider } from "@/lib/themes/queries";
import { canManageStore } from "@/lib/auth/permissions";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { lookOf } from "@/lib/templates/engine/theme-style";
import { getPublishedDesign } from "@/services/storefront.service";
import { getPreviewStoreData } from "@/services/theme.service";

export const metadata: Metadata = { title: "Themes" };

/** Online Store > Themes: browse ready-made storefront themes, preview them with your own products, apply one and customize it. */
export default async function ThemesPage() {
  const { active } = await requireWorkspaceCan("dashboard:view");
  const data = await getPreviewStoreData();
  // The design shoppers get right now (the published home page, never the draft): the deployment preview on the status card.
  const design = await getPublishedDesign(data.store.slug);
  const deployed = design ? { document: design.layout.template.document, theme: design.layout.theme, groups: design.layout.groups ?? {}, versionNumber: design.layout.template.version_number, look: lookOf(design.layout.theme) } : null;
  return (
    <>
      <PageHeader title="Themes" description="Choose how your online store looks. Preview a theme with your own products, then customize it in the editor. Nothing goes live until you publish." />
      <ThemeQueryProvider>
        <ThemeStore
          canManage={canManageStore(active)}
          data={data}
          deployed={deployed}
          storeHost={storefrontHost(data.store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId)}
          storeUrl={storefrontUrl(data.store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId) ?? `/s/${data.store.slug}`}
        />
      </ThemeQueryProvider>
    </>
  );
}
