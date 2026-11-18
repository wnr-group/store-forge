"use client";

import { useLayoutEffect, useRef } from "react";
import { partStyleDeclarations } from "@/lib/editor/style";
import { collapseText, type TextOverride } from "@/lib/editor/text";

type Entry = { orig: string; shown: string };
/** The inline style an element had before a text style was added to it. */
const inlineBefore = new WeakMap<Element, string>();
const styled = new Set<Element>();
/** What each text node said before it was replaced, so a changed or removed override can put it back. */
const originals = new WeakMap<Text, Entry>();

function clearStyles() {
  for (const el of styled) {
    const before = inlineBefore.get(el);
    if (before === undefined) continue;
    if (before) el.setAttribute("style", before);
    else el.removeAttribute("style");
    inlineBefore.delete(el);
  }
  styled.clear();
}

function apply(root: HTMLElement, map: Map<string, string>, styles: Map<string, string>) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const parent = n.parentElement;
    if (parent && /^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName)) continue;
    const rec = originals.get(n);
    // If React has rewritten the node since we replaced it, what it holds now is the new original.
    const base = rec && n.data === rec.shown ? rec.orig : n.data;
    const wanted = map.get(collapseText(base));
    const look = styles.get(collapseText(base));
    if (look && parent) {
      if (!inlineBefore.has(parent)) inlineBefore.set(parent, parent.getAttribute("style") ?? "");
      styled.add(parent);
      parent.style.cssText = `${inlineBefore.get(parent)};${look}`;
    }
    if (wanted !== undefined) {
      if (n.data !== wanted) n.data = wanted;
      originals.set(n, { orig: base, shown: wanted });
    } else if (rec && n.data === rec.shown) {
      n.data = rec.orig;
      originals.delete(n);
    }
  }
}

/**
 * Shows a section's text overrides. The server renders the theme's own words; once the page is live in the browser the matching
 * text nodes are replaced (and kept replaced when React updates around them). `display: contents`: no box of its own, so a
 * sticky header or a flex layout inside is unaffected.
 */
export function TextOverrides({ overrides, children }: { overrides: readonly TextOverride[]; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(overrides);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const list = JSON.parse(key) as TextOverride[];
    const map = new Map<string, string>(list.map((o) => [o.from, o.to]));
    const styles = new Map<string, string>(list.flatMap((o) => (o.style ? [[o.from, partStyleDeclarations(o.style)] as [string, string]] : [])));
    const run = () => {
      observer.disconnect();
      clearStyles();
      apply(root, map, styles);
      observer.observe(root, { childList: true, characterData: true, subtree: true });
    };
    const observer = new MutationObserver(run);
    run();
    return () => {
      observer.disconnect();
      clearStyles();
      apply(root, new Map(), new Map());
    };
  }, [key]);
  return (
    <div ref={ref} style={{ display: "contents" }} data-sf-text="">
      {children}
    </div>
  );
}
