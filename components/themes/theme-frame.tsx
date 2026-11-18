"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderMode } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";
import type { PreviewStoreData } from "@/lib/themes/types";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

/** `texts`: the text of the clicked element and of its text-bearing ancestors, innermost first. */
export type ClickTarget = { sectionId: string; blockId?: string; texts?: string[]; image?: string };

/** The picture a clicked `<img>` shows, as a storage path or theme asset name (the optimiser's wrapper url is unwrapped). */
function imageSource(img: HTMLImageElement | null): string | undefined {
  const src = img?.getAttribute("src");
  if (!src) return undefined;
  try {
    const wrapped = new URL(src, "http://x").searchParams.get("url");
    return wrapped ?? src;
  } catch {
    return src;
  }
}

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
  /** Section or block clicks, in editor mode. `text` and `image` say what was under the pointer, to find the setting behind it. */
  onSelect?: (target: ClickTarget) => void;
  selectedSectionId?: string | null;
  /** The selected block inside that section, outlined instead of the section. */
  selectedBlockId?: string | null;
  /** A fixed scale (1 = 100%). Without it the page is scaled to fit the space. */
  zoom?: number | null;
  /** The product or collection a product or collection page shows. */
  resource?: Record<string, unknown>;
  className?: string;
};

const TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,a,button,span,li,label,blockquote,dt,dd";

const BLANK_PAGE = "<!doctype html><html><head></head><body></body></html>";

/**
 * A device screen: an iframe exactly `width` CSS pixels wide, with the dashboard's own stylesheets copied in, and `children`
 * rendered into it through a portal (so they keep the dashboard's React context). Tailwind's responsive rules (sm:, lg:, ...)
 * follow the width of the window they run in, so only inside a real window of the device's width does a "mobile" preview lay
 * out as the mobile site. The iframe is the device viewport: it scrolls inside, and its scrollbar is hidden so the page gets
 * the full width it is meant to have.
 */
function DeviceScreen({ width, height, scale, left, children }: { width: number; height: number; scale: number; left: number; children: React.ReactNode }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  const setup = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    const doc = event.currentTarget.contentDocument;
    if (!doc || doc.getElementById("sf-screen-root")) return;
    const meta = doc.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    doc.head.appendChild(meta);
    const hide = doc.createElement("style");
    hide.textContent = "html{scrollbar-width:none}::-webkit-scrollbar{display:none}body{margin:0}";
    doc.head.appendChild(hide);
    const loaded: Promise<void>[] = [];
    window.document.head.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
      const copy = node.cloneNode(true);
      if (node instanceof HTMLLinkElement) loaded.push(new Promise<void>((resolve) => { copy.addEventListener("load", () => resolve()); copy.addEventListener("error", () => resolve()); }));
      doc.head.appendChild(copy);
    });
    doc.documentElement.className = window.document.documentElement.className;
    doc.body.className = window.document.body.className;
    const root = doc.createElement("div");
    root.id = "sf-screen-root";
    doc.body.appendChild(root);
    setMount(root);
    // Shown once the styles are in (or after a moment), so the page never flashes unstyled.
    void Promise.race([Promise.all(loaded), new Promise((resolve) => window.setTimeout(resolve, 2500))]).then(() => setShown(true));
  };

  return (
    <>
      <iframe
        title="Theme preview"
        srcDoc={BLANK_PAGE}
        onLoad={setup}
        className="block origin-top-left border-0 bg-white"
        style={{ width, height, transform: `scale(${scale})`, marginLeft: left, opacity: shown ? 1 : 0, transition: "opacity 150ms" }}
      />
      {mount ? createPortal(children, mount) : null}
    </>
  );
}

/**
 * The page exactly as shoppers get it: the same `TemplateRenderer`, laid out at a fixed device width and scaled to the
 * space available. Nothing here is a mock-up, so what the merchant sees is what the storefront renders. Links and forms
 * inside never navigate; in editor mode a click selects the section or block under the pointer instead.
 */
export function ThemeFrame({ document, theme, groups, data, device = "desktop", mode = "preview", cropHeight, onSelect, selectedSectionId, selectedBlockId, zoom, resource, className }: ThemeFrameProps) {
  const outer = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ sectionId: string; blockId?: string } | null>(null);
  const [available, setAvailable] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    const measure = () => {
      setAvailable(o.clientWidth);
      setViewport(window.innerHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
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
  const fit = available > 0 ? Math.min(1, available / width) : 1;
  const scale = zoom ? Math.max(0.25, Math.min(2, zoom)) : fit;
  const editing = mode === "editor";

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    // Nothing in a preview may navigate away or submit.
    if (target.closest("a, button, form, input, select, textarea, summary")) event.preventDefault();
    if (!editing || !onSelect) return;
    const section = target.closest<HTMLElement>("[data-sf-section]");
    if (!section) return;
    const block = target.closest<HTMLElement>("[data-sf-block]");
    const texts: string[] = [];
    for (let el: HTMLElement | null = target.closest<HTMLElement>(TEXT_TAGS); el && texts.length < 4 && section.contains(el); el = el.parentElement?.closest<HTMLElement>(TEXT_TAGS) ?? null) {
      const t = el.textContent?.trim();
      if (t) texts.push(t.slice(0, 600));
    }
    onSelect({ sectionId: section.dataset.sfSection!, blockId: block?.dataset.sfBlock, texts, image: imageSource(target.closest("img")) });
  };

  const handleOver = (event: React.MouseEvent) => {
    if (!editing) return;
    const target = event.target as HTMLElement;
    const section = target.closest<HTMLElement>("[data-sf-section]")?.dataset.sfSection;
    const blockId = target.closest<HTMLElement>("[data-sf-block]")?.dataset.sfBlock;
    setHover((prev) => (section ? (prev?.sectionId === section && prev.blockId === blockId ? prev : { sectionId: section, blockId }) : prev ? null : prev));
  };

  // Every frame but a gallery thumbnail is a device screen: its own window of the device's width, so the theme answers with its
  // real tablet or phone layout. Thumbnails stay cheap and in the page (they are a fixed crop of the top of the desktop page).
  const isolated = !cropHeight;
  const screenHeight = Math.min(1100, Math.max(480, viewport - 210));
  // The page is centred when it is narrower than the space (a phone or tablet at full size, or any zoomed-out page).
  const left = Math.max(0, (available - width * scale) / 2);

  const body = (
    <>
      <div
        onClickCapture={handleClick}
        onMouseOver={editing ? handleOver : undefined}
        onMouseLeave={editing ? () => setHover(null) : undefined}
        className={cn("sf-frame", !isolated && "origin-top-left")}
        style={isolated ? undefined : { width, visibility: available > 0 ? "visible" : "hidden", transform: `scale(${scale})`, marginLeft: left }}
        data-static={cropHeight ? "" : undefined}
        data-editing={editing || undefined}
        data-selected={selectedSectionId ?? undefined}
      >
        {content}
      </div>
      {/* A preview shows the finished page at once: the scroll reveals and entrance animations of a live storefront are switched off
          here (and every transition in a gallery thumbnail), so nothing waits to scroll into view or keeps animating. */}
      <style>{`.sf-frame [data-sf-reveal],.sf-frame [data-sf-reveal] .sf-word,.sf-frame .sf-up,.sf-frame .sf-hero-word{animation:none!important;transition:none!important;opacity:1!important;translate:none!important}.sf-frame[data-static] *{animation:none!important;transition:none!important}`}</style>
      {/* Selection and hover outlines. Ids come from the document's own node ids; CSS.escape keeps them inert. The selected block
          is outlined instead of its section; hover outlines the innermost block or section under the pointer. */}
      {editing && selectedSectionId ? (
        <style>
          {selectedBlockId
            ? `.sf-frame [data-sf-block="${CSS.escape(selectedBlockId)}"]{outline:2px solid var(--editor-accent,#2563eb)!important;outline-offset:2px}.sf-frame [data-sf-section="${CSS.escape(selectedSectionId)}"]{outline:1px dashed var(--editor-accent,#2563eb);outline-offset:-1px}`
            : `.sf-frame [data-sf-section="${CSS.escape(selectedSectionId)}"]{outline:2px solid var(--editor-accent,#2563eb);outline-offset:-2px}`}
        </style>
      ) : null}
      {editing && hover ? (
        <style>
          {hover.blockId
            ? `.sf-frame [data-sf-block="${CSS.escape(hover.blockId)}"]{outline:1px dashed #2563eb;outline-offset:2px}`
            : `.sf-frame [data-sf-section="${CSS.escape(hover.sectionId)}"]{outline:1px dashed #2563eb;outline-offset:-1px}`}
        </style>
      ) : null}
      {editing ? <style>{`.sf-frame[data-editing] [data-sf-section],.sf-frame[data-editing] [data-sf-block]{cursor:pointer}`}</style> : null}
    </>
  );

  if (isolated) {
    return (
      <div ref={outer} className={cn("relative w-full overflow-hidden", className)} style={{ height: viewport > 0 ? screenHeight : undefined, minHeight: 480 }}>
        {available > 0 ? (
          <DeviceScreen width={width} height={screenHeight / scale} scale={scale} left={left}>
            {body}
          </DeviceScreen>
        ) : null}
      </div>
    );
  }

  return (
    // A cropped frame (a gallery thumbnail) has its height from the start, so the card around it never grows or jumps as the page inside
    // is measured. Until the width is known the page would show at full size for a moment, so it stays invisible until then.
    <div ref={outer} className={cn("relative w-full overflow-hidden", className)} style={{ height: cropHeight, minHeight: cropHeight }}>
      {body}
    </div>
  );
}
