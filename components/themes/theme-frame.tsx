"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderMode } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";
import type { PreviewStoreData } from "@/lib/themes/types";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

type Groups = { header?: TemplateDocument | null; footer?: TemplateDocument | null; announcement?: TemplateDocument | null };

export type ThemeFrameProps = {
  document: TemplateDocument;
  theme?: Record<string, unknown> | null;
  groups?: Groups;
  data: PreviewStoreData;
  device?: Device;
  mode?: RenderMode;
  /** Shows at most this many pixels of the page (for gallery thumbnails). */
  cropHeight?: number;
  /** Section or block clicks, in editor mode. */
  onSelect?: (target: { sectionId: string; blockId?: string }) => void;
  selectedSectionId?: string | null;
  /** The product or collection a product or collection page shows. */
  resource?: Record<string, unknown>;
  className?: string;
};

/**
 * The page exactly as shoppers get it: the same `TemplateRenderer`, laid out at a fixed device width and scaled to the
 * space available. Nothing here is a mock-up, so what the merchant sees is what the storefront renders. Links and forms
 * inside never navigate; in editor mode a click selects the section or block under the pointer instead.
 */
export function ThemeFrame({ document, theme, groups, data, device = "desktop", mode = "preview", cropHeight, onSelect, selectedSectionId, resource, className }: ThemeFrameProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      setAvailable(o.clientWidth);
      setContentHeight(i.scrollHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, []);

  // The storefront is rebuilt only when what it shows changes. Measuring (every image that loads changes the height) re-renders
  // this component, and without this each of those renders would rebuild the whole page.
  const headerGroup = groups?.header;
  const footerGroup = groups?.footer;
  const announcementGroup = groups?.announcement;
  const content = useMemo(
    () => (
      <TemplateRenderer
        document={document}
        mode={mode}
        context={{
          store: data.store,
          collections: data.collections,
          collectionProducts: data.collectionProducts,
          resource,
          theme: theme ?? undefined,
          groupHeader: headerGroup ?? undefined,
          groupFooter: footerGroup ?? undefined,
          groupAnnouncement: announcementGroup ?? undefined,
        }}
      />
    ),
    [document, mode, data, resource, theme, headerGroup, footerGroup, announcementGroup],
  );

  const width = DEVICE_WIDTH[device];
  const scale = available > 0 ? Math.min(1, available / width) : 1;
  const shownHeight = cropHeight ? Math.min(contentHeight * scale, cropHeight) : contentHeight * scale;
  const editing = mode === "editor";

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    // Nothing in a preview may navigate away or submit.
    if (target.closest("a, button, form, input, select, textarea, summary")) event.preventDefault();
    if (!editing || !onSelect) return;
    const section = target.closest<HTMLElement>("[data-sf-section]");
    if (!section) return;
    const block = target.closest<HTMLElement>("[data-sf-block]");
    onSelect({ sectionId: section.dataset.sfSection!, blockId: block?.dataset.sfBlock });
  };

  return (
    // A cropped frame (a gallery thumbnail) has its height from the start, so the card around it never grows or jumps as the page inside
    // is measured. A full frame follows the page height. Until the width is known the page would show at full size for a moment,
    // so it stays invisible until then.
    <div ref={outer} className={cn("relative w-full overflow-hidden", className)} style={{ height: cropHeight ?? (shownHeight || undefined), minHeight: cropHeight ?? 80 }}>
      <div
        ref={inner}
        onClickCapture={handleClick}
        className="sf-frame origin-top-left"
        style={{ width, visibility: available > 0 ? "visible" : "hidden", transform: `scale(${scale})`, marginLeft: device === "desktop" || scale < 1 ? 0 : Math.max(0, (available - width) / 2) }}
        data-static={cropHeight ? "" : undefined}
        data-editing={editing || undefined}
        data-selected={selectedSectionId ?? undefined}
      >
        {content}
      </div>
      {/* A preview shows the finished page at once: the scroll reveals and entrance animations of a live storefront are switched off
          here (and every transition in a gallery thumbnail), so nothing waits to scroll into view or keeps animating. */}
      <style>{`.sf-frame [data-sf-reveal],.sf-frame [data-sf-reveal] .sf-word,.sf-frame .sf-up,.sf-frame .sf-hero-word{animation:none!important;transition:none!important;opacity:1!important;translate:none!important}.sf-frame[data-static] *{animation:none!important;transition:none!important}`}</style>
      {editing && selectedSectionId ? (
        <style>{`.sf-frame [data-sf-section="${CSS.escape(selectedSectionId)}"]{outline:2px solid var(--editor-accent,#2563eb);outline-offset:-2px}`}</style>
      ) : null}
      {editing ? <style>{`.sf-frame[data-editing] [data-sf-section]{cursor:pointer}.sf-frame[data-editing] [data-sf-section]:hover{outline:1px dashed #2563eb;outline-offset:-1px}`}</style> : null}
    </div>
  );
}
