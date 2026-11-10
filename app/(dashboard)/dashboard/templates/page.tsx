import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TemplatesWorkspace } from "@/components/templates/templates-workspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageStore } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { getPublicStorefront } from "@/services/storefront.service";
import { getTemplateSettings } from "@/services/template-settings.service";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { active, store } = await requireWorkspace();

  if (!store) {
    return (
      <>
        <PageHeader title="Templates" description="Choose how your public storefront looks." />
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>No store yet</CardTitle>
              <CardDescription>This workspace does not have a store.</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        </div>
      </>
    );
  }

  // The slug comes from the user's own primary store, never from the client. getPublicStorefront() applies the same
  // public filtering as the live page, and returns null for an inactive or suspended store (preview unavailable).
  const [saved, storefront] = await Promise.all([getTemplateSettings(), getPublicStorefront(store.slug)]);

  return (
    <>
      <PageHeader title="Templates" description="Choose how your public storefront looks and customize it. Changes go live when you save." />
      <TemplatesWorkspace key={saved?.updatedAt ?? "none"} saved={saved} storefront={storefront} canEdit={canManageStore(active)} />
    </>
  );
}
