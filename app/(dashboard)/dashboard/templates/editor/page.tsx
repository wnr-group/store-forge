import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditorShell, type EditorInit } from "@/components/themes/editor/editor-shell";
import { ROUTES } from "@/config/app";
import { canManageStore } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { ThemeQueryProvider } from "@/lib/themes/queries";
import type { ThemeKind } from "@/lib/themes/types";
import { getCurrentTheme, getPreviewStoreData, getTemplate, listTemplates } from "@/services/theme.service";

export const metadata: Metadata = { title: "Theme editor" };

const PAGE_KINDS: ThemeKind[] = ["index", "product", "collection"];
const SHARED_KINDS: ThemeKind[] = ["theme_settings", "group_header", "group_footer", "group_announcement"];

type Props = { searchParams: Promise<{ page?: string }> };

/** The visual editor: the page structure, a live preview built by the storefront's own renderer, and the settings of the selection. */
export default async function ThemeEditorPage({ searchParams }: Props) {
  const { active } = await requireWorkspaceCan("dashboard:view");
  const { page } = await searchParams;
  const all = (await listTemplates()).filter((t) => t.status === "active");
  const pages = all.filter((t) => PAGE_KINDS.includes(t.kind) && t.isDefault).sort((a, b) => PAGE_KINDS.indexOf(a.kind) - PAGE_KINDS.indexOf(b.kind));
  // No design yet: send the merchant to pick a theme first.
  if (pages.length === 0) redirect(ROUTES.templates);

  const chosen = pages.find((p) => p.id === page) ?? pages[0];
  const shared = all.filter((t) => SHARED_KINDS.includes(t.kind));
  const [docs, current, data] = await Promise.all([
    Promise.all([chosen, ...shared].map((t) => getTemplate(t.id))),
    getCurrentTheme(),
    getPreviewStoreData({ collectionProducts: true, productPage: true, contentPages: true }),
  ]);

  const init: EditorInit = {
    tenantId: active.tenant.id,
    canManage: canManageStore(active),
    storeSlug: data.store.slug,
    themeName: current.theme?.name ?? null,
    pages: pages.map((p) => ({ id: p.id, kind: p.kind, name: p.name })),
    pageId: chosen.id,
    docs: docs.map((d) => ({ templateId: d.id, kind: d.kind, name: d.name, revision: d.revision, document: d.document })),
    data,
  };

  return (
    <ThemeQueryProvider>
      <EditorShell init={init} />
    </ThemeQueryProvider>
  );
}
