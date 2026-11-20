"use client";

import { useEffect, useRef, useState } from "react";

export type Pick = { sectionId: string; blockId?: string };
type Box = { top: number; left: number; width: number; height: number };

/**
 * The product card picked on the page, and what its + menu offers. `index` is the card's position among the cards of its section.
 * `items` are the elements a card can show, `on` says which it shows now; `onToggle` adds (true) or removes (false) one.
 */
export type CardTools = {
  sectionId: string;
  index: number;
  disabled: boolean;
  items: { key: string; label: string; help: string; on: boolean; /** What the card shows for it now (the name, the price ...). */ value?: string; /** The field of the product this element edits; none for an element that is only shown or hidden. */ edit?: string }[];
  onToggle: (key: string, on: boolean) => void;
  /** Opens the product's own details (name, price, picture ...) with this field first. */
  onEdit: (field: string) => void;
  /** Adds a new product to the store; left out where adding is not possible (demo products, no access). */
  onAddProduct?: () => void;
};

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
export function SelectionOverlay({ frame, selected, hover, labelFor, card }: { frame: React.RefObject<HTMLElement | null>; selected: Pick | null; hover: Pick | null; labelFor?: (pick: Pick) => string; card?: CardTools | null }) {
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ selected: Box | null; hover: Box | null; card: Box | null }>({ selected: null, hover: null, card: null });
  const [layerWidth, setLayerWidth] = useState(0);
  const cardKey = card ? `${card.sectionId}/${card.index}` : "";

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
    const [cardSection, cardIndex] = cardKey.split("/");

    const measure = () => {
      const origin = layerEl.getBoundingClientRect();
      const boxOf = (pick: Pick | null): Box | null => {
        const el = elementFor(frameEl, pick);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top - origin.top), left: Math.round(r.left - origin.left), width: Math.round(r.width), height: Math.round(r.height) };
      };
      let cardBox: Box | null = null;
      if (cardKey) {
        const el = frameEl.querySelectorAll<HTMLElement>(`[data-sf-section="${CSS.escape(cardSection)}"] [data-sf-card]`)[Number(cardIndex)];
        if (el) {
          const r = el.getBoundingClientRect();
          cardBox = { top: Math.round(r.top - origin.top), left: Math.round(r.left - origin.left), width: Math.round(r.width), height: Math.round(r.height) };
        }
      }
      setLayerWidth(Math.round(origin.width));
      const next = { selected: boxOf(sel), hover: boxOf(hov), card: cardBox };
      setBoxes((prev) => (same(prev.selected, next.selected) && same(prev.hover, next.hover) && same(prev.card, next.card) ? prev : next));
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
  }, [frame, selectedKey, hoverKey, cardKey]);

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
      {card && boxes.card && boxes.card.width > 0 ? <CardToolbar key={cardKey} box={boxes.card} layerWidth={layerWidth} tools={card} frame={frame} /> : null}
    </div>
  );
}

const MENU_W = 244;

/**
 * Over the selected product card: a blue border and, above it, a small bar with a + button. The + opens a list of the card's
 * elements (name, price, picture ...); picking one adds it to the card, picking a shown one takes it away. Drawn in the overlay,
 * so it never changes the page's own layout; only the bar and the menu take clicks.
 */
function CardToolbar({ box, layerWidth, tools, frame }: { box: Box; layerWidth: number; tools: CardTools; frame: React.RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const doc = frame.current?.ownerDocument;
    if (!doc) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    doc.addEventListener("pointerdown", away, true);
    doc.addEventListener("keydown", key);
    return () => {
      doc.removeEventListener("pointerdown", away, true);
      doc.removeEventListener("keydown", key);
    };
  }, [open, frame]);

  const barTop = box.top >= 40 ? box.top - 36 : box.top + 8;
  const centre = box.left + box.width / 2;
  const menuLeft = Math.max(8, Math.min(centre - MENU_W / 2, (layerWidth || centre * 2) - MENU_W - 8));
  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  return (
    <>
      <div style={{ position: "absolute", top: box.top, left: box.left, width: box.width, height: box.height, boxSizing: "border-box", border: `2px solid ${BLUE}`, boxShadow: "0 0 0 1px rgba(255,255,255,.7)" }} />
      <div ref={wrap} style={{ pointerEvents: "auto", font: `500 12px/1 ${font}` }}>
        <div style={{ position: "absolute", top: barTop, left: centre, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, padding: "3px 3px 3px 10px", background: BLUE, color: "#fff", borderRadius: 999, boxShadow: "0 4px 14px rgba(37,99,235,.35)", whiteSpace: "nowrap" }}>
          <span style={{ font: `600 11px/20px ${font}` }}>Product card</span>
          <button
            type="button"
            aria-label="Edit this product and choose what its card shows"
            aria-expanded={open}
            title="Edit this product and choose what its card shows"
            onClick={() => setOpen((v) => !v)}
            style={{ display: "grid", placeItems: "center", width: 24, height: 24, border: 0, borderRadius: 999, background: "#fff", color: BLUE, font: `700 17px/1 ${font}`, cursor: "pointer", paddingBottom: 1 }}
          >
            {open ? "\u00d7" : "+"}
          </button>
        </div>
        {open ? (
          <div role="menu" aria-label="Product card elements" style={{ position: "absolute", top: barTop + 34, left: menuLeft, width: MENU_W, padding: 6, background: "#fff", color: "#111827", border: "1px solid rgba(17,24,39,.12)", borderRadius: 12, boxShadow: "0 14px 40px rgba(17,24,39,.22)" }}>
            <div style={{ padding: "6px 8px 6px", font: `600 10px/1 ${font}`, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280" }}>Edit product</div>
            {tools.items.map((item) => {
              const row = { display: "flex", alignItems: "center", gap: 2, borderRadius: 8 } as const;
              const main = { display: "block", minWidth: 0, flex: 1, padding: "8px", border: 0, borderRadius: 8, background: "transparent", textAlign: "left", cursor: "pointer", font: `400 13px/1.25 ${font}`, color: "inherit" } as const;
              return (
                <div key={item.key} style={row} onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!item.edit && tools.disabled}
                    onClick={() => {
                      if (!item.edit) return tools.onToggle(item.key, !item.on);
                      setOpen(false);
                      tools.onEdit(item.edit);
                    }}
                    style={{ ...main, opacity: item.on ? 1 : 0.55, cursor: !item.edit && tools.disabled ? "not-allowed" : "pointer" }}
                  >
                    <span style={{ display: "block", fontWeight: 600 }}>{item.label}</span>
                    <span style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#6b7280", fontSize: 11.5 }}>
                      {item.edit ? (item.value ? item.value : "Click to edit") : item.on ? "Shown on the card" : item.help}
                    </span>
                  </button>
                  {item.edit ? <span aria-hidden style={{ color: BLUE, fontSize: 11, fontWeight: 600, paddingRight: 2 }}>Edit</span> : null}
                  <button
                    type="button"
                    aria-pressed={item.on}
                    aria-label={`${item.on ? "Hide" : "Show"} ${item.label} on the card`}
                    title={item.on ? "Shown on the card. Click to hide." : "Hidden. Click to show on the card."}
                    disabled={tools.disabled}
                    onClick={() => tools.onToggle(item.key, !item.on)}
                    style={{ display: "grid", placeItems: "center", flex: "none", width: 30, height: 30, margin: "0 4px 0 0", border: 0, borderRadius: 8, background: "transparent", color: item.on ? BLUE : "#9ca3af", cursor: tools.disabled ? "not-allowed" : "pointer", opacity: tools.disabled ? 0.55 : 1 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                      {item.on ? null : <path d="M3 3l18 18" />}
                    </svg>
                  </button>
                </div>
              );
            })}
            {tools.onAddProduct ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  tools.onAddProduct?.();
                }}
                style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 6, margin: "6px 0 2px", padding: "9px 8px", border: `1px dashed ${BLUE}`, borderRadius: 8, background: "rgba(37,99,235,.05)", color: BLUE, cursor: "pointer", font: `600 12.5px/1 ${font}` }}
              >
                <span aria-hidden style={{ font: "700 16px/1 system-ui" }}>+</span> Add a new product
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
