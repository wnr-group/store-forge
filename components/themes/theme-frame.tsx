"use client";

import { useEffect, useRef, useState } from "react";
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
    <div ref={outer} className={cn("relative w-full overflow-hidden", className)} style={{ height: shownHeight || undefined, minHeight: 80 }}>
      <div
        ref={inner}
        onClickCapture={handleClick}
        className="sf-frame origin-top-left"
        style={{ width, transform: `scale(${scale})`, marginLeft: device === "desktop" || scale < 1 ? 0 : Math.max(0, (available - width) / 2) }}
        data-editing={editing || undefined}
        data-selected={selectedSectionId ?? undefined}
      >
        <TemplateRenderer
          document={document}
          mode={mode}
          context={{
            store: data.store,
            collections: data.collections,
            resource,
            theme: theme ?? undefined,
            groupHeader: groups?.header ?? undefined,
            groupFooter: groups?.footer ?? undefined,
            groupAnnouncement: groups?.announcement ?? undefined,
          }}
        />
      </div>
      {editing && selectedSectionId ? (
        <style>{`.sf-frame [data-sf-section="${CSS.escape(selectedSectionId)}"]{outline:2px solid var(--editor-accent,#2563eb);outline-offset:-2px}`}</style>
      ) : null}
      {editing ? <style>{`.sf-frame[data-editing] [data-sf-section]{cursor:pointer}.sf-frame[data-editing] [data-sf-section]:hover{outline:1px dashed #2563eb;outline-offset:-1px}`}</style> : null}
    </div>
  );
}
