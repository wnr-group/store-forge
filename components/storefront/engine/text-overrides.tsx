"use client";

import { useLayoutEffect, useRef } from "react";
import { collapseText, type TextOverride } from "@/lib/editor/text";

type Entry = { orig: string; shown: string };
/** What each text node said before it was replaced, so a changed or removed override can put it back. */
const originals = new WeakMap<Text, Entry>();

function apply(root: HTMLElement, map: Map<string, string>) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const parent = n.parentElement;
    if (parent && /^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName)) continue;
    const rec = originals.get(n);
    // If React has rewritten the node since we replaced it, what it holds now is the new original.
    const base = rec && n.data === rec.shown ? rec.orig : n.data;
    const wanted = map.get(collapseText(base));
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
    const map = new Map<string, string>((JSON.parse(key) as TextOverride[]).map((o) => [o.from, o.to]));
    const run = () => {
      observer.disconnect();
      apply(root, map);
      observer.observe(root, { childList: true, characterData: true, subtree: true });
    };
    const observer = new MutationObserver(run);
    run();
    return () => {
      observer.disconnect();
      apply(root, new Map());
    };
  }, [key]);
  return (
    <div ref={ref} style={{ display: "contents" }} data-sf-text="">
      {children}
    </div>
  );
}
