import type { Metadata } from "next";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NavigationEditor, type LinkChoice } from "@/components/navigation/navigation-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { canManageStore } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import type { TemplateDocument } from "@/lib/templates/document";
import { readMenu } from "@/lib/themes/navigation";
import { getCatalogLinkChoices } from "@/services/catalog.service";
import { listPages } from "@/services/pages.service";
import { getPreviewStoreData, getTemplate, listTemplates } from "@/services/theme.service";

export const metadata: Metadata = { title: "Navigation" };

/** Online Store > Navigation: the links in the header of the storefront. */
export default async function NavigationPage() {
  const { active } = await requireWorkspaceCan("dashboard:view");
  const header = (await listTemplates()).find((t) => t.kind === "group_header" && t.status === "active");
  const description = "Choose the links customers see at the top of your store.";

  if (!header) {
    return (
      <>
        <PageHeader title="Navigation" description={description} />
        <EmptyState
          icon={Menu}
          title="Choose a theme first"
          description="The menu is part of your theme's header. Pick a theme and it will appear here."
          action={
            <Link href={ROUTES.templates} className={buttonVariants()}>
              Browse themes
            </Link>
          }
        />
      </>
    );
  }

  const [detail, pages, data, catalogLinks] = await Promise.all([getTemplate(header.id), listPages(), getPreviewStoreData(), getCatalogLinkChoices()]);
  const document = detail.document as unknown as TemplateDocument;

  if (readMenu(document) === null) {
    return (
      <>
        <PageHeader title="Navigation" description={description} />
        <EmptyState icon={Menu} title="This header has no menu" description="The header of your current theme does not support a menu. Add a header section in the theme editor." action={<Link href={ROUTES.themeEditor} className={buttonVariants()}>Open the editor</Link>} />
      </>
    );
  }

  const choices: LinkChoice[] = [
    { label: "Home", url: "/" },
    { label: "All products", url: "/products" },
    { label: "All collections", url: "/collections" },
    { label: "Search", url: "/search" },
    ...catalogLinks,
    ...data.collections.map((c) => ({ label: `Collection: ${c.name}`, url: `/collections/${c.slug}` })),
    ...pages.filter((p) => p.status === "published").map((p) => ({ label: `Page: ${p.title}`, url: `/${p.slug}` })),
  ];

  return (
    <>
      <PageHeader title="Navigation" description={description} />
      <NavigationEditor templateId={detail.id} revision={detail.revision} document={document} choices={choices} canManage={canManageStore(active)} hasUnpublishedChanges={detail.publicationState !== "published"} />
    </>
  );
}
