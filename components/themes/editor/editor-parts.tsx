import { AlertTriangle, ChevronRight, CircleAlert, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { ComponentNode } from "@/lib/templates/document";
import { getRegistry } from "@/lib/templates/registry/index";
import { findNode, type SaveStatus } from "@/lib/themes/editor/shell-logic";
import type { EditorState } from "@/lib/themes/editor/state";
import type { PreviewData } from "@/lib/themes/preview-data";
import { cn } from "@/lib/utils";
import type { usePreviewTarget, TargetKind } from "./use-preview-target";

const registry = getRegistry();

/** What is about to go live, so the owner is never surprised: pages and shared parts with unpublished changes, and customized products. */
export function PublishSummary({
  pages,
  products,
  unsaved,
  unverified,
  checking,
  checkingPages,
  skipped,
  truncated,
  onRetry,
}: {
  pages: string[];
  products: (string | null)[];
  unsaved: number;
  /** Never-published product drafts not yet known to be empty or real: not counted either way. */
  unverified: number;
  checking: boolean;
  /** The list of pages and their publication states is being read again: what is pending may not be complete yet. */
  checkingPages: boolean;
  skipped: number;
  /** The list of customized products was cut off (more than the pages read). */
  truncated: boolean;
  onRetry: () => void;
}) {
  const uncertain = unverified > 0 || truncated;
  // "Nothing new" is only said once the state is known; while it is being read the answer is not yet known.
  if (pages.length === 0 && products.length === 0 && unsaved === 0 && !uncertain && !checkingPages) return <p className="text-sm text-muted-foreground">There is nothing new to publish.</p>;
  const named = products.filter((n): n is string => Boolean(n));
  const others = products.length - named.length;
  return (
    <div className="mt-2 space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm" aria-label="What will be published">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Will go live</p>
      {pages.length > 0 ? <p>Pages and shared parts: {pages.join(", ")}</p> : null}
      {products.length > 0 ? (
        <p>
          {products.length} {products.length === 1 ? "product" : "products"} with their own settings
          {named.length > 0 ? `: ${named.slice(0, 5).join(", ")}${named.length > 5 ? "…" : ""}` : ""}
          {others > 0 && named.length > 0 ? ` and ${others} more` : ""}
        </p>
      ) : null}
      {pages.length === 0 && products.length === 0 && !uncertain && unsaved > 0 ? <p>Your latest edits.</p> : null}
      {checkingPages ? <p className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking publication status…</p> : null}
      {unverified > 0 ? (
        <p className="text-muted-foreground">
          {checking ? `Checking ${unverified} more ${unverified === 1 ? "product" : "products"} with drafts…` : `${unverified} more ${unverified === 1 ? "product has a draft" : "products have drafts"} that could not be checked${skipped > 0 ? " (too many to check at once)" : ""}, so they may or may not go live.`}
          {!checking ? <> <button type="button" onClick={onRetry} className="underline underline-offset-2">Check again</button></> : null}
        </p>
      ) : null}
      {truncated ? <p className="text-muted-foreground">Your store has more customized products than are listed here, so others may also go live.</p> : null}
    </div>
  );
}

export function RailTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-none",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
      {label}
    </button>
  );
}

export function SaveIndicator({ status, dirty = 0 }: { status: SaveStatus; dirty?: number }) {
  const map: Record<SaveStatus, { text: string; tone: string; icon: React.ReactNode }> = {
    saved: { text: "All changes saved", tone: "text-muted-foreground", icon: <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> },
    unsaved: { text: dirty > 0 ? `Saving soon · ${dirty} unsaved` : "Unsaved changes", tone: "text-muted-foreground", icon: <span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> },
    saving: { text: "Saving…", tone: "text-muted-foreground", icon: <Loader2 className="size-3.5 animate-spin" aria-hidden /> },
    error: { text: "Not saved", tone: "text-destructive", icon: <CircleAlert className="size-3.5" aria-hidden /> },
    conflict: { text: "Out of date", tone: "text-destructive", icon: <AlertTriangle className="size-3.5" aria-hidden /> },
    invalid: { text: "Fix errors to save", tone: "text-destructive", icon: <CircleAlert className="size-3.5" aria-hidden /> },
  };
  const s = map[status];
  return (
    <span role="status" className={cn("flex items-center gap-1.5 text-xs", s.tone)}>
      {s.icon}{s.text}
    </span>
  );
}

/** Where the selection sits in the page (Section > Block), each part clickable, so a nested element can be left for its parent. */
export function SelectionPath({ state, onSelect }: { state: EditorState; onSelect: (docId: string, sectionId: string, blockId?: string) => void }) {
  const sel = state.selection;
  if (!sel || !("sectionId" in sel)) return null;
  const section = (state.docs[sel.docId]?.document as { sections?: Record<string, ComponentNode> } | undefined)?.sections?.[sel.sectionId];
  if (!section) return null;
  const block = sel.blockId ? findNode(section, sel.blockId) : undefined;
  const sectionName = registry.sections[section.type]?.name ?? section.type;
  return (
    <nav aria-label="Selected element" className="mb-2 flex items-center justify-center gap-1 text-xs">
      <Button type="button" size="xs" variant={block ? "ghost" : "secondary"} aria-current={block ? undefined : "true"} onClick={() => onSelect(sel.docId, sel.sectionId)}>{sectionName}</Button>
      {block ? (
        <>
          <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
          <Button type="button" size="xs" variant="secondary" aria-current="true">{registry.blocks[block.type]?.name ?? block.type}</Button>
        </>
      ) : null}
    </nav>
  );
}

/** Which product, collection or content page is shown on a page that shows one of them. */
export function PreviewTargetSelect({ page, virtualPage, preview, target, disabled, onChoose }: {
  page: EditorState["docs"][string] | undefined;
  virtualPage: string | null;
  preview: PreviewData;
  target: ReturnType<typeof usePreviewTarget>;
  disabled: boolean;
  onChoose: (kind: TargetKind, slug: string) => void;
}) {
  const kind: TargetKind | null = virtualPage === "content" ? "content" : virtualPage ? null : page?.kind === "product" ? "product" : page?.kind === "collection" ? "collection" : null;
  if (!kind) return null;
  const options =
    kind === "product" ? preview.store.products.map((p) => ({ slug: p.slug, label: p.name }))
    : kind === "collection" ? preview.collections.map((c) => ({ slug: c.slug, label: c.name }))
    : target.contentPages.map((p) => ({ slug: p.slug, label: p.title }));
  const value = kind === "product" ? target.productSlug : kind === "collection" ? target.collectionSlug : target.contentPage?.slug;
  if (options.length === 0) return null;
  return (
    <NativeSelect aria-label={kind === "product" ? "Product to preview" : kind === "collection" ? "Collection to preview" : "Content page to preview"} value={value ?? ""} disabled={disabled} onChange={(e) => onChoose(kind, e.target.value)} className="hidden h-8 w-36 text-xs md:block lg:w-44">
      {options.map((o) => (
        <option key={o.slug} value={o.slug}>{o.label}</option>
      ))}
    </NativeSelect>
  );
}
