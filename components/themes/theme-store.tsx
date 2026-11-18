"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Laptop, LayoutTemplate, Loader2, Monitor, Palette, Search, Smartphone, Tablet } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/app";
import type { TemplateDocument } from "@/lib/templates/document";
import { ActionError, useApplyTheme, useCurrentTheme, useThemeDetail, useThemeList, useTemplates } from "@/lib/themes/queries";
import { hasStoreProducts, previewData, type PreviewData, type PreviewMode } from "@/lib/themes/preview-data";
import { INDUSTRY_LABELS, THEME_INDUSTRIES, type PreviewStoreData, type ThemeIndustry, type ThemeSummary } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { PreviewModeNote, PreviewModeSwitch } from "./preview-mode-switch";
import { PreviewLoader, useImagesReady } from "./preview-loader";
import { ThemeFrame, type Device } from "./theme-frame";

const PAGE_SIZE = 9;

/** True once the element has come within `margin` of the screen, and stays true. Cards below the fold cost nothing until then. */
function useNearScreen<T extends Element>(margin = "300px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, near]);
  return [ref, near] as const;
}

/** True a moment after `active` turns on, so a heavy child mounts after the dialog has finished opening instead of during it. */
function useAfterOpen(active: boolean, delay = 220) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      const reset = window.setTimeout(() => setReady(false), 0);
      return () => window.clearTimeout(reset);
    }
    const t = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(t);
  }, [active, delay]);
  return active && ready;
}

type Props = { canManage: boolean; data: PreviewStoreData };

export function ThemeStore({ canManage, data }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<ThemeIndustry | undefined>();
  const [page, setPage] = useState(1);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const list = useThemeList({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, industry });
  const current = useCurrentTheme();
  const templates = useTemplates();
  const apply = useApplyTheme();
  // The merchant's own catalogue by default; demo content only when they ask for it.
  const [mode, setMode] = useState<PreviewMode>("store");
  const preview = useMemo(() => previewData(data, mode), [data, mode]);
  const storeHasProducts = hasStoreProducts(data);

  const hasWork = (templates.data?.length ?? 0) > 0;
  const currentTheme = current.data?.theme ?? null;

  const doApply = async (slug: string) => {
    try {
      const result = await apply.mutateAsync(slug);
      setConfirmSlug(null);
      setPreviewSlug(null);
      toast.success(`${result.theme.name} is ready to customize`, { description: "It is saved as a draft. Nothing changes on your live store until you publish." });
      router.push(ROUTES.themeEditor);
    } catch (error) {
      toast.error(error instanceof ActionError ? error.message : "Could not apply the theme. Please try again.");
    }
  };

  const requestApply = (slug: string) => {
    if (!canManage) return;
    if (hasWork && currentTheme?.slug !== slug) setConfirmSlug(slug);
    else if (currentTheme?.slug === slug) router.push(ROUTES.themeEditor);
    else void doApply(slug);
  };

  return (
    <div className="space-y-6">
      <CurrentThemeCard loading={current.isLoading} theme={currentTheme} updateAvailable={current.data?.updateAvailable ?? false} data={preview} canManage={canManage} />

      {!canManage ? (
        <Alert>
          <AlertDescription>You can browse and preview themes. Ask the store owner for settings access to apply or customize one.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by industry">
          <FilterChip active={!industry} onClick={() => { setIndustry(undefined); setPage(1); }}>All</FilterChip>
          {THEME_INDUSTRIES.map((i) => (
            <FilterChip key={i} active={industry === i} onClick={() => { setIndustry(i); setPage(1); }}>{INDUSTRY_LABELS[i]}</FilterChip>
          ))}
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
        <PreviewModeSwitch mode={mode} onChange={setMode} className="shrink-0" />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search themes" aria-label="Search themes" className="pl-8" />
        </div>
        </div>
      </div>
      <PreviewModeNote mode={mode} storeHasProducts={storeHasProducts} className="-mt-3" />

      {list.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            {list.error instanceof ActionError ? list.error.message : "Themes could not be loaded."}
            <Button size="sm" variant="outline" onClick={() => list.refetch()}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : list.isLoading ? (
        <GallerySkeleton />
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No themes match" description="Try a different search or industry." action={<Button variant="outline" onClick={() => { setSearch(""); setIndustry(undefined); }}>Clear filters</Button>} />
      ) : (
        <>
          <ul className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", list.isFetching && "opacity-70 transition-opacity")}>
            {list.data?.items.map((theme) => (
              <li key={theme.id}>
                <ThemeCard theme={theme} data={preview} canManage={canManage} onPreview={() => setPreviewSlug(theme.slug)} onApply={() => requestApply(theme.slug)} />
              </li>
            ))}
          </ul>
          {list.data && list.data.totalPages > 1 ? (
            <nav className="flex items-center justify-between text-sm" aria-label="Theme pages">
              <span className="text-muted-foreground">Page {list.data.page} of {list.data.totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      <PreviewDialog slug={previewSlug} data={preview} canManage={canManage} applying={apply.isPending} isCurrent={previewSlug === currentTheme?.slug} onClose={() => setPreviewSlug(null)} onApply={(slug) => requestApply(slug)} />

      <AlertDialog open={confirmSlug !== null} onOpenChange={(open) => { if (!open) setConfirmSlug(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to this theme?</AlertDialogTitle>
            <AlertDialogDescription>
              The new theme replaces your unpublished edits. Your live store stays exactly as it is until you publish, and your products, collections, customers and orders are not touched. Anything you have published can be restored from version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apply.isPending}>Keep current</AlertDialogCancel>
            <AlertDialogAction disabled={apply.isPending} onClick={() => confirmSlug && void doApply(confirmSlug)}>
              {apply.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Switch theme
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function CurrentThemeCard({ loading, theme, updateAvailable, data, canManage }: { loading: boolean; theme: ThemeSummary | null; updateAvailable: boolean; data: PreviewStoreData; canManage: boolean }) {
  const detail = useThemeDetail(theme?.slug ?? null);
  const [imagesRef, imagesReady] = useImagesReady(Boolean(theme && detail.data?.documents.index));
  if (loading) return <Skeleton className="h-28 w-full rounded-lg" />;
  return (
    <section aria-labelledby="current-theme" className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <div className="relative w-full shrink-0 overflow-hidden rounded-md border bg-muted sm:w-44">
        <div aria-hidden inert ref={imagesRef}>
        {theme && detail.data?.documents.index ? (
          <ThemeFrame document={detail.data.documents.index as unknown as TemplateDocument} theme={detail.data.documents.theme_settings} groups={groupsOf(detail.data.documents)} data={data} cropHeight={110} className="pointer-events-none" />
        ) : (
          <div className="flex h-[110px] items-center justify-center text-muted-foreground"><Palette className="size-6" /></div>
        )}
        </div>
        {theme && !detail.isError && !imagesReady ? <PreviewLoader ready={false} label="Loading" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Current theme</p>
        <h2 id="current-theme" className="text-lg font-semibold">{theme ? theme.name : "Built-in storefront"}</h2>
        <p className="text-sm text-muted-foreground">
          {theme ? theme.description : "Your store uses the default template. Pick a theme below to start designing your storefront."}
        </p>
        {updateAvailable ? <Badge className="mt-2" variant="secondary">A newer version of this theme is available</Badge> : null}
      </div>
      {canManage && theme ? (
        <Link href={ROUTES.themeEditor} className={buttonVariants()}>
          <Palette aria-hidden /> Customize
        </Link>
      ) : null}
    </section>
  );
}

function groupsOf(documents: Record<string, Record<string, unknown> | undefined>) {
  return {
    header: (documents.group_header as unknown as TemplateDocument) ?? null,
    footer: (documents.group_footer as unknown as TemplateDocument) ?? null,
    announcement: (documents.group_announcement as unknown as TemplateDocument) ?? null,
  };
}

function ThemeCard({ theme, data, canManage, onPreview, onApply }: { theme: ThemeSummary; data: PreviewStoreData; canManage: boolean; onPreview: () => void; onApply: () => void }) {
  // A card fetches and draws its live preview only once it is near the screen, so opening the page costs a few cards, not all nine.
  const [frameRef, near] = useNearScreen<HTMLDivElement>();
  const detail = useThemeDetail(near ? theme.slug : null);
  const doc = detail.data?.documents.index as unknown as TemplateDocument | undefined;
  // The layout draws at once but its photos arrive later: a loader stays over the preview until they are in.
  const [imagesRef, imagesReady] = useImagesReady(Boolean(doc));
  return (
    <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md">
      {/* The live frame holds the storefront's own buttons, so it cannot sit inside a button: it is inert and a sibling button covers it. */}
      <div ref={frameRef} className="relative w-full overflow-hidden border-b bg-muted">
        <div inert aria-hidden="true" ref={imagesRef}>
          {doc ? (
            <ThemeFrame document={doc} theme={detail.data?.documents.theme_settings} groups={groupsOf(detail.data!.documents)} data={data} cropHeight={300} className="pointer-events-none" />
          ) : detail.isError ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">Preview unavailable</div>
          ) : (
            <div className="h-[300px] w-full" />
          )}
        </div>
        {detail.isError ? null : <PreviewLoader ready={imagesReady} />}
        <button type="button" onClick={onPreview} aria-label={`Preview ${theme.name}`} className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/30 to-transparent pb-3 opacity-0 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span className="rounded-md bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-sm">Preview theme</span>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{theme.name}</h3>
            {theme.isCurrent ? <Badge variant="secondary"><Check className="size-3" aria-hidden /> Current</Badge> : <span className="text-xs text-muted-foreground">{INDUSTRY_LABELS[theme.industry]}</span>}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{theme.description}</p>
        </div>
        <div className="mt-auto flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onPreview}>Preview</Button>
          {canManage ? (
            <Button size="sm" className="flex-1" onClick={onApply}>{theme.isCurrent ? "Customize" : "Apply theme"}</Button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

function PreviewDialog({ slug, data, canManage, applying, isCurrent, onClose, onApply }: { slug: string | null; data: PreviewData; canManage: boolean; applying: boolean; isCurrent: boolean; onClose: () => void; onApply: (slug: string) => void }) {
  const detail = useThemeDetail(slug);
  const [device, setDevice] = useState<Device>("desktop");
  const theme = detail.data;
  const ready = useAfterOpen(slug !== null);
  const [imagesRef, imagesReady] = useImagesReady(Boolean(theme?.documents.index && ready), 9000);
  return (
    <Dialog open={slug !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Fade only: no zoom, so the large preview does not scale in. */}
      <DialogContent className="flex h-[calc(100dvh-2rem)] max-w-none flex-col gap-0 p-0 duration-150 [--tw-enter-scale:1]! [--tw-exit-scale:1]! sm:max-w-[min(1400px,calc(100%-2rem))]">
        <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b p-4 pr-12">
          <div className="min-w-0">
            <DialogTitle>{theme?.name ?? "Theme preview"}</DialogTitle>
            <DialogDescription className="line-clamp-1">{theme?.description ?? "Loading the theme"}</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5" role="group" aria-label="Preview size">
              {DEVICES.map(({ id, label, icon: Icon }) => (
                <Button key={id} size="icon-sm" variant={device === id ? "secondary" : "ghost"} onClick={() => setDevice(id)} aria-label={label} aria-pressed={device === id}>
                  <Icon aria-hidden />
                </Button>
              ))}
            </div>
            {canManage && slug ? (
              <Button onClick={() => onApply(slug)} disabled={applying}>
                {applying ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {isCurrent ? "Customize" : "Apply theme"}
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/60 p-4">
          <PreviewModeNote mode={data.mode} storeHasProducts={data.store.products.length > 0 || data.mode === "demo"} className="mb-3" />
          {theme?.documents.index && ready ? (
            // Keyed by theme only: changing the device just rescales the frame, it does not rebuild the whole page.
            <motion.div key={slug} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className={cn("relative mx-auto overflow-hidden rounded-md border bg-white shadow-sm", device === "desktop" ? "w-full" : device === "tablet" ? "w-[820px] max-w-full" : "w-[390px] max-w-full")}>
              <div ref={imagesRef}>
                <ThemeFrame document={theme.documents.index as unknown as TemplateDocument} theme={theme.documents.theme_settings} groups={groupsOf(theme.documents)} data={data} device={device === "desktop" ? "desktop" : device} />
              </div>
              <PreviewLoader ready={imagesReady} />
            </motion.div>
          ) : detail.isError ? (
            <div className="flex h-60 items-center justify-center text-sm text-muted-foreground"><Laptop className="mr-2 size-4" aria-hidden /> This preview could not be loaded.</div>
          ) : (
            <div className="relative mx-auto h-[70dvh] w-full max-w-5xl overflow-hidden rounded-md"><PreviewLoader ready={false} label="Loading theme preview" /></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GallerySkeleton() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading themes">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-lg border bg-card">
          <Skeleton className="h-[300px] w-full rounded-none" />
          <div className="space-y-2 p-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-8 w-full" /></div>
        </li>
      ))}
    </ul>
  );
}
