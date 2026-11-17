import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ThemeStore } from "@/components/themes/theme-store";
import { ThemeQueryProvider } from "@/lib/themes/queries";
import { canManageStore } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getPreviewStoreData } from "@/services/theme.service";

export const metadata: Metadata = { title: "Themes" };

/** Online Store > Themes: browse ready-made storefront themes, preview them with your own products, apply one and customize it. */
export default async function ThemesPage() {
  const { active } = await requireWorkspaceCan("dashboard:view");
  const data = await getPreviewStoreData();
  return (
    <>
      <PageHeader title="Themes" description="Choose how your online store looks. Preview a theme with your own products, then customize it in the editor. Nothing goes live until you publish." />
      <ThemeQueryProvider>
        <ThemeStore canManage={canManageStore(active)} data={data} />
      </ThemeQueryProvider>
    </>
  );
}
