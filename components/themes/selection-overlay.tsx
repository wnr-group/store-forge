"use client";

import { useEffect, useRef, useState } from "react";

export type Pick = { sectionId: string; blockId?: string };
type Box = { top: number; left: number; width: number; height: number };

const BLUE = "#2563eb";

function elementFor(frame: HTMLElement, pick: Pick | null): HTMLElement | null {
  if (!pick) return null;
  const byBlock = pick.blockId ? frame.querySelector<HTMLElement>(`[data-sf-block="${CSS.escape(pick.blockId)}"]`) : null;
  return byBlock ?? frame.querySelector<HTMLElement>(`[data-sf-section="${CSS.escape(pick.sectionId)}"]`);
}

const same = (a: Box | null, b: Box | null) => (a === null || b === null ? a === b : a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/**
 * Draws the selection and hover borders on top of the preview, like a page builder: a solid blue border and a name tag on the
 * selected element, a lighter border on the one under the pointer. They are measured from the real elements and drawn in a layer
 * above the page, so no section's overflow can clip them and they never change the page's own layout. The layer sits in the
 * preview window, which scrolls as one page, so a box only needs measuring again when something resizes or moves.
 */
export function SelectionOverlay({ frame, selected, hover, labelFor }: { frame: React.RefObject<HTMLElement | null>; selected: Pick | null; hover: Pick | null; labelFor?: (pick: Pick) => string }) {
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ selected: Box | null; hover: Box | null }>({ selected: null, hover: null });

  const selectedKey = selected ? `${selected.sectionId}/${selected.blockId ?? ""}` : "";
  const hoverKey = hover ? `${hover.sectionId}/${hover.blockId ?? ""}` : "";

  useEffect(() => {
    const frameEl = frame.current;
    const layerEl = layer.current;
    if (!frameEl || !layerEl) return;
    const win = frameEl.ownerDocument.defaultView;
    const [sectionId, blockId] = selectedKey.split("/");
    const [hoverSection, hoverBlock] = hoverKey.split("/");
    const sel: Pick | null = selectedKey ? { sectionId, blockId: blockId || undefined } : null;
    const hov: Pick | null = hoverKey && hoverKey !== selectedKey ? { sectionId: hoverSection, blockId: hoverBlock || undefined } : null;

    const measure = () => {
      const origin = layerEl.getBoundingClientRect();
      const boxOf = (pick: Pick | null): Box | null => {
        const el = elementFor(frameEl, pick);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top - origin.top), left: Math.round(r.left - origin.left), width: Math.round(r.width), height: Math.round(r.height) };
      };
      const next = { selected: boxOf(sel), hover: boxOf(hov) };
      setBoxes((prev) => (same(prev.selected, next.selected) && same(prev.hover, next.hover) ? prev : next));
    };
    let raf = requestAnimationFrame(measure);
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    // Anything that can move or resize an element: the page itself, pictures arriving, scrolling (a sticky header), the window.
    const resize = new ResizeObserver(schedule);
    resize.observe(frameEl);
    const mutations = new MutationObserver(schedule);
    mutations.observe(frameEl, { subtree: true, childList: true, attributes: true, characterData: true });
    frameEl.addEventListener("load", schedule, true);
    win?.addEventListener("scroll", schedule, { passive: true });
    win?.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      mutations.disconnect();
      frameEl.removeEventListener("load", schedule, true);
      win?.removeEventListener("scroll", schedule);
      win?.removeEventListener("resize", schedule);
    };
  }, [frame, selectedKey, hoverKey]);

  const outline = (box: Box | null, pick: Pick | null, kind: "selected" | "hover") => {
    if (!box || !pick || box.width === 0 || box.height === 0) return null;
    const isSelected = kind === "selected";
    const label = labelFor?.(pick);
    const above = box.top >= 22;
    return (
      <div
        key={kind}
        style={{
          position: "absolute",
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          boxSizing: "border-box",
          border: `${isSelected ? 2 : 1}px solid ${isSelected ? BLUE : "rgba(37,99,235,.65)"}`,
          boxShadow: isSelected ? "0 0 0 1px rgba(255,255,255,.7), inset 0 0 0 1px rgba(255,255,255,.35)" : undefined,
          background: isSelected ? "transparent" : "rgba(37,99,235,.06)",
          transition: "top 90ms ease-out, left 90ms ease-out, width 90ms ease-out, height 90ms ease-out",
        }}
      >
        {label && (isSelected || above) ? (
          <span
            style={{
              position: "absolute",
              left: -2,
              top: above ? -22 : 0,
              maxWidth: Math.max(80, box.width + 40),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 7px",
              font: "600 11px/20px system-ui, -apple-system, 'Segoe UI', sans-serif",
              color: "#fff",
              background: isSelected ? BLUE : "rgba(37,99,235,.8)",
              borderRadius: above ? "4px 4px 4px 0" : "0 0 4px 0",
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div ref={layer} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2147483000 }}>
      {outline(boxes.hover, hover, "hover")}
      {outline(boxes.selected, selected, "selected")}
    </div>
  );
}
