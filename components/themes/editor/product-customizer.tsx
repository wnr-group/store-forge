"use client";

import { Info, Loader2, MousePointerClick, RotateCcw, Rocket, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { publicImageUrl } from "@/lib/storage/paths";
import { BLOCK_LABELS, GALLERY_LAYOUTS, HIDEABLE_BLOCKS, MEDIA_POSITIONS, type GalleryLayout, type HideableBlock, type MediaPosition } from "@/lib/templates/product-presentation";
import type { PresentationEntry, ProductActionState } from "@/lib/themes/editor/presentation-state";
import type { LayoutState } from "@/lib/themes/refresh";
import { FocalPointPicker } from "./focal-point-picker";
import { ProductStatusBadge, type ProductStatus } from "./product-status";

const LAYOUT_LABEL: Record<GalleryLayout, string> = { thumbnails: "Thumbnails", stacked: "Stacked" };
const POSITION_LABEL: Record<MediaPosition, string> = { left: "Pictures on the left", right: "Pictures on the right" };

type Props = {
  /** idle: no product chosen yet; loading: a product is being loaded; error: it could not be loaded. */
  load: { status: "idle" | "loading" | "ready" | "error"; error: string | null };
  entry: PresentationEntry | null;
  /** The settings API could not be reached for this product (for example it is not available yet). */
  unavailable: string | null;
  /** The product's primary picture path, for the focal point. */
  primaryImagePath: string | null;
  /** What the page template says today, used as the "same as the page" labels. */
  inherited: { layout: GalleryLayout; mediaPosition: MediaPosition };
  /** Which of the six items the page template has at all. */
  available: Record<HideableBlock, boolean>;
  /** What is known about the shared product-page layout. It has its own status, independent of this product's settings. */
  layoutState: LayoutState;
  /** The name of the product being loaded after a pick, or null. While set, nothing here may act. */
  loadingName: string | null;
  /** What the controls may do right now (see productActions): nothing while loading, no editing of an unsupported version. */
  actions: ProductActionState;
  /** Problems by setting path, e.g. `gallery.layout`. */
  problems: Record<string, string>;
  busy: "publishing" | "resetting" | null;
  status: ProductStatus;
  onLayout: (v: GalleryLayout | undefined) => void;
  onPosition: (v: MediaPosition | undefined) => void;
  onFocal: (v: { x: number; y: number } | undefined) => void;
  onHidden: (block: HideableBlock, hidden: boolean) => void;
  onPublish: () => void;
  onResetAll: () => void;
  onRetry: () => void;
};

/** The right-hand panel of the Product tab: this product's own gallery, picture focus and visible blocks. */
export function ProductCustomizer(p: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  // Another product is loading: the controls on screen would still belong to the previous one, so none are shown.
  if (p.loadingName !== null || (p.load.status === "loading" && !p.entry)) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading {p.loadingName ?? "the product"}…</p>
        <p className="text-xs text-muted-foreground">Its settings appear here in a moment. Nothing on this panel can be changed until then.</p>
        <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (p.load.status === "idle") return <Empty title="Choose a product" text="Pick a product on the left to preview it and change how its page looks. Other products stay as they are." />;
  if (p.load.status === "error" && !p.entry) {
    return (
      <div className="space-y-3 p-4">
        <Alert variant="destructive"><AlertDescription>{p.load.error ?? "This product could not be loaded."}</AlertDescription></Alert>
        <Button size="sm" variant="outline" onClick={p.onRetry}>Try again</Button>
      </div>
    );
  }
  if (!p.entry) {
    return (
      <div className="space-y-3 p-4">
        <Alert><TriangleAlert aria-hidden /><AlertDescription>{p.unavailable ?? "Product design settings are not available right now."}</AlertDescription></Alert>
        <Button size="sm" variant="outline" onClick={p.onRetry}>Try again</Button>
      </div>
    );
  }

  const { document: doc } = p.entry;
  const layout = doc.gallery?.layout;
  const position = doc.gallery?.mediaPosition;
  const focal = doc.focalPoint;
  const hidden = new Set(doc.hiddenBlocks ?? []);
  const readOnly = p.entry.unsupported;

  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-semibold break-words">{p.entry.name}</h2>
          <ProductStatusBadge status={p.status} prefix className="shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground">These settings apply to this product only. Every other product keeps the store design.</p>
      </header>

      {p.layoutState === "pending" ? (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>The product page layout, shared by all products, has unpublished changes. Use the global Publish button to publish them.</AlertDescription>
        </Alert>
      ) : p.layoutState === "checking" ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking whether the shared page layout has unpublished changes…</p>
      ) : p.layoutState === "unavailable" ? (
        <p className="text-xs text-muted-foreground">Could not check whether the shared page layout has unpublished changes.</p>
      ) : null}

      {readOnly ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertDescription>
            These settings use {readOnly.version === null ? "a version" : `version ${readOnly.version}`} that this editor does not support, so they cannot be edited or published here. They are left exactly as they are, and your store ignores them. Update the app to edit them, or reset the product to remove them.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field
        label="Gallery layout"
        id="pp-layout"
        isSet={layout !== undefined}
        onReset={() => p.onLayout(undefined)}
        disabled={!p.actions.edit}
        error={p.problems["gallery.layout"]}
        help="Thumbnails shows one large picture with small pictures below it. Stacked shows every picture one under the other."
      >
        <NativeSelect id="pp-layout" value={layout ?? ""} disabled={!p.actions.edit} aria-invalid={Boolean(p.problems["gallery.layout"])} onChange={(e) => p.onLayout(e.target.value === "" ? undefined : (e.target.value as GalleryLayout))}>
          <option value="">Same as the product page ({LAYOUT_LABEL[p.inherited.layout]})</option>
          {GALLERY_LAYOUTS.map((v) => <option key={v} value={v}>{LAYOUT_LABEL[v]}</option>)}
        </NativeSelect>
      </Field>

      <Field
        label="Media position"
        id="pp-position"
        isSet={position !== undefined}
        onReset={() => p.onPosition(undefined)}
        disabled={!p.actions.edit}
        error={p.problems["gallery.mediaPosition"]}
        help="On wide screens. On phones the pictures always come first."
      >
        <NativeSelect id="pp-position" value={position ?? ""} disabled={!p.actions.edit} aria-invalid={Boolean(p.problems["gallery.mediaPosition"])} onChange={(e) => p.onPosition(e.target.value === "" ? undefined : (e.target.value as MediaPosition))}>
          <option value="">Same as the product page ({POSITION_LABEL[p.inherited.mediaPosition]})</option>
          {MEDIA_POSITIONS.map((v) => <option key={v} value={v}>{POSITION_LABEL[v]}</option>)}
        </NativeSelect>
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Image focal point</Label>
          {focal ? <ResetButton disabled={!p.actions.edit} onClick={() => p.onFocal(undefined)} label="Reset focal point" /> : null}
        </div>
        <FocalPointPicker imageUrl={publicImageUrl(p.primaryImagePath)} value={focal} onChange={p.onFocal} disabled={!p.actions.edit} />
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y"] as const).map((axis) => (
            <div key={axis} className="space-y-1">
              <Label htmlFor={`pp-focal-${axis}`} className="text-xs text-muted-foreground">{axis === "x" ? "Across (%)" : "Down (%)"}</Label>
              <Input
                id={`pp-focal-${axis}`}
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                disabled={!p.actions.edit}
                value={focal ? focal[axis] : 50}
                aria-invalid={Boolean(p.problems[`focalPoint.${axis}`])}
                onChange={(e) => {
                  if (e.target.value === "") return;
                  const n = Number(e.target.value);
                  p.onFocal({ x: focal?.x ?? 50, y: focal?.y ?? 50, [axis]: n });
                }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{focal ? "The storefront keeps this spot in view when it crops the main picture." : "Not set: the picture is centred, as it is now. Click the picture to choose its most important spot."}</p>
        {p.problems.focalPoint || p.problems["focalPoint.x"] || p.problems["focalPoint.y"] ? <p role="alert" className="text-xs text-destructive">{p.problems.focalPoint ?? p.problems["focalPoint.x"] ?? p.problems["focalPoint.y"]}</p> : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Show on this product page</legend>
        {HIDEABLE_BLOCKS.map((block) => {
          const present = p.available[block];
          const shown = !hidden.has(block);
          return (
            <div key={block} className="space-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`pp-block-${block}`} className="text-xs font-medium">{BLOCK_LABELS[block]}</Label>
                <div className="flex items-center gap-2">
                  {!shown ? <ResetButton disabled={!p.actions.edit} onClick={() => p.onHidden(block, false)} label={`Show ${BLOCK_LABELS[block]} again`} /> : null}
                  <Switch id={`pp-block-${block}`} checked={shown} disabled={!p.actions.edit || (!present && shown)} onCheckedChange={(checked) => p.onHidden(block, !checked)} />
                </div>
              </div>
              {!present ? <p className="text-xs text-muted-foreground">Your product page does not include this.</p> : null}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Hiding only affects this product. The title and price are always shown.</p>
      </fieldset>

      {p.problems[""] ? <Alert variant="destructive"><AlertDescription>{p.problems[""]}</AlertDescription></Alert> : null}
      {p.unavailable ? <Alert><TriangleAlert aria-hidden /><AlertDescription>{p.unavailable}</AlertDescription></Alert> : null}

      <div className="space-y-2 border-t pt-4">
        <Button className="w-full" disabled={!p.actions.publish} onClick={p.onPublish}>
          {p.busy === "publishing" ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Publish this product
        </Button>
        <p className="text-xs text-muted-foreground">Publishes only this product&apos;s settings. The Publish button at the top publishes your whole store.</p>
        <Button variant="outline" className="w-full" disabled={!p.actions.reset} onClick={() => setConfirmReset(true)}>
          {p.busy === "resetting" ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />} Reset to the store design
        </Button>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {p.entry.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all of this product&apos;s settings, the draft and the published ones. The live product page goes back to the store design straight away, without a publish step. The product itself is not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep settings</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmReset(false); p.onResetAll(); }}>Reset product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResetButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <Button type="button" size="xs" variant="ghost" disabled={disabled} onClick={onClick} aria-label={label} className="text-muted-foreground">
      <RotateCcw aria-hidden /> Reset
    </Button>
  );
}

function Field({ label, id, isSet, onReset, disabled, error, help, children }: { label: string; id: string; isSet: boolean; onReset: () => void; disabled: boolean; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
        {isSet ? <ResetButton disabled={disabled} onClick={onReset} label={`Reset ${label}`} /> : null}
      </div>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MousePointerClick className="size-5" aria-hidden /></span>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="max-w-56 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
