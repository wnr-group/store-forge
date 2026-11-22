import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EditorShell, type EditorInit } from "@/components/themes/editor/editor-shell";
import { ROUTES } from "@/config/app";
import { canManageStore } from "@/lib/auth/permissions";
import { toFailure } from "@/lib/errors";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { ThemeQueryProvider } from "@/lib/themes/queries";
import type { ProductPreview, ThemeKind } from "@/lib/themes/types";
import { loadProductPreview } from "@/services/presentation.service";
import { getCurrentTheme, getPreviewStoreData, getTemplate, listTemplates } from "@/services/theme.service";

export const metadata: Metadata = { title: "Theme editor" };

const PAGE_KINDS: ThemeKind[] = ["index", "product", "collection"];
const SHARED_KINDS: ThemeKind[] = ["theme_settings", "group_header", "group_footer", "group_announcement"];

type Props = { searchParams: Promise<{ page?: string; product?: string }> };

/** A product link (`?product=<id>`) must be a product id; anything else is ignored. */
const productIdParam = z.string().uuid();

/** The visual editor: the page structure, a live preview built by the storefront's own renderer, and the settings of the selection. */
export default async function ThemeEditorPage({ searchParams }: Props) {
  const { active } = await requireWorkspaceCan("dashboard:view");
  const { page, product } = await searchParams;
  const productId = productIdParam.safeParse(product);
  const all = (await listTemplates()).filter((t) => t.status === "active");
  const pages = all.filter((t) => PAGE_KINDS.includes(t.kind) && t.isDefault).sort((a, b) => PAGE_KINDS.indexOf(a.kind) - PAGE_KINDS.indexOf(b.kind));
  // No design yet: send the merchant to pick a theme first.
  if (pages.length === 0) redirect(ROUTES.templates);

  // A product link opens the Product page, unless a page was asked for.
  const chosen = pages.find((p) => p.id === page) ?? (productId.success ? pages.find((p) => p.kind === "product") : undefined) ?? pages[0];
  const shared = all.filter((t) => SHARED_KINDS.includes(t.kind));
  const [docs, current, data] = await Promise.all([
    Promise.all([chosen, ...shared].map((t) => getTemplate(t.id))),
    getCurrentTheme(),
    getPreviewStoreData({ collectionProducts: true, productPage: true, contentPages: true }),
  ]);

  // The Product page starts on the linked product, or on the store's first product as it always did.
  let initialProduct: ProductPreview | null = null;
  let initialProductError: string | null = null;
  if (chosen.kind === "product") {
    const slug = data.store.products[0]?.slug;
    const target = productId.success ? { productId: productId.data } : slug ? { slug } : null;
    if (target) {
      try {
        initialProduct = await loadProductPreview(target);
      } catch (error) {
        initialProductError = toFailure(error).error;
      }
    }
  }

  const init: EditorInit = {
    tenantId: active.tenant.id,
    canManage: canManageStore(active),
    storeSlug: data.store.slug,
    storeHost: storefrontHost(data.store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId),
    storeUrl: storefrontUrl(data.store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId),
    themeName: current.theme?.name ?? null,
    pages: pages.map((p) => ({ id: p.id, kind: p.kind, name: p.name })),
    pageId: chosen.id,
    docs: docs.map((d) => ({ templateId: d.id, kind: d.kind, name: d.name, revision: d.revision, document: d.document })),
    data,
    initialProduct,
    initialProductError,
  };

  return (
    <ThemeQueryProvider>
      <EditorShell init={init} />
    </ThemeQueryProvider>
  );
}
