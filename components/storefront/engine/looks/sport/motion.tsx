"use client";

import { Fragment, useEffect } from "react";

const PENDING = "[data-sf-reveal]:not([data-sf-revealed])";

/**
 * Drives the `data-sf-reveal` scroll reveals in globals.css: marks each element revealed the first time it enters the
 * viewport (never replays) and picks up elements added later by client navigation. Nothing is hidden until this runs, so
 * the page reads fine without JavaScript, and elements already on screen at start-up are shown as they are instead of
 * blinking out and back in. Renders nothing; the Sport header mounts it once.
 */
export function SportMotion() {
  useEffect(() => {
    const root = document.documentElement;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Writing an attribute React did not render would fail hydration, so an element waits until React has claimed it.
    const fiberKey = Object.keys(document.body).find((k) => k.startsWith("__reactFiber$"));
    const waiting = new Set<Element>();
    let retry = 0;
    let passes = 0;
    const flush = () => {
      retry = 0;
      passes++;
      const batch = [...waiting];
      waiting.clear();
      batch.forEach((el) => reveal(el));
      if (!waiting.size) passes = 0;
    };
    const reveal = (el: Element) => {
      waiting.delete(el);
      // Give up waiting after ~5s so nothing can stay hidden.
      if (fiberKey && passes < 100 && el.isConnected && !(fiberKey in el)) {
        waiting.add(el);
        retry ||= window.setTimeout(flush, 50);
        return;
      }
      (el as HTMLElement).dataset.sfRevealed = "";
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          reveal(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const track = (el: Element, initial: boolean) => {
      if (initial) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) return reveal(el);
      }
      io.observe(el);
    };

    document.querySelectorAll(PENDING).forEach((el) => track(el, true));
    root.dataset.sfRevealOn = "";

    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        rec.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches(PENDING)) track(n, false);
          n.querySelectorAll(PENDING).forEach((el) => track(el, false));
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(retry);
      io.disconnect();
      mo.disconnect();
      delete root.dataset.sfRevealOn;
    };
  }, []);

  return null;
}

/**
 * A heading whose words rise one after another from behind a mask once it scrolls into view. Stays one readable heading for
 * assistive tech: the spans are presentational and the full text is the label.
 */
export function SplitWords({ children, className }: { children: string; className?: string }) {
  const words = children.split(" ").filter(Boolean);
  return (
    <span data-sf-reveal="words" aria-label={children} className={className}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span aria-hidden className="sf-mask">
            <span className="sf-word" style={{ ["--i" as string]: i } as React.CSSProperties}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </span>
  );
}
