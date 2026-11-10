"use client";

import { useRef, type ElementType } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "./motion";

/**
 * Entrance effects, one per section so the page has rhythm instead of one repeated fade-up.
 * Each plays once as the element scrolls into view. With reduced motion they skip straight to the final state.
 * `data-reveal` lets the page's <noscript> rule keep everything visible without JavaScript.
 */

type Tag = "div" | "li" | "ul" | "p" | "span" | "section" | "article" | "figure";
type Values = Record<string, string | number>;
type Common = { as?: Tag; delay?: number; amount?: number; className?: string; children?: React.ReactNode };

function Enter({ as = "div", from, to, delay = 0, duration = 0.9, amount = 0.2, className, children }: Common & { from: Values; to: Values; duration?: number }) {
  const still = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      data-reveal
      initial={still ? false : from}
      whileInView={to}
      viewport={{ once: true, amount, margin: "0px 0px -6% 0px" }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/** Opacity only: slow and quiet. */
export function Fade(props: Common & { duration?: number }) {
  return <Enter {...props} from={{ opacity: 0 }} to={{ opacity: 1 }} duration={props.duration ?? 1.2} />;
}

/** Glides in sideways (or vertically) from an offset. */
export function SlideIn({ x = -40, y = 0, ...rest }: Common & { x?: number; y?: number; duration?: number }) {
  return <Enter {...rest} from={{ opacity: 0, x, y }} to={{ opacity: 1, x: 0, y: 0 }} duration={rest.duration ?? 1} />;
}

/** Grows from slightly smaller, settling into place. */
export function ScaleIn({ scale = 0.92, y = 18, ...rest }: Common & { scale?: number; y?: number; duration?: number }) {
  return <Enter {...rest} from={{ opacity: 0, scale, y }} to={{ opacity: 1, scale: 1, y: 0 }} duration={rest.duration ?? 0.9} />;
}

/*
 * The next three hide their own element (clipped, translated behind a mask, or scaled to zero). An
 * IntersectionObserver cannot see an element like that, so it would never fire. Each one therefore watches a stable
 * outer wrapper with useInView and animates an inner element instead.
 */

/** Uncovers its content like a curtain drawing back: from left to right, or (from="top") from top to bottom. */
export function Wipe({ as = "div", delay = 0, amount = 0.2, duration = 1.1, from = "left", className, children }: Common & { duration?: number; from?: "left" | "top" }) {
  const still = useReducedMotion();
  const outer = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const seen = useInView(outer, { once: true, amount, margin: "0px 0px -6% 0px" });
  const Outer = as as ElementType;
  if (still) return <Outer className={className}>{children}</Outer>;
  return (
    <Outer ref={outer} data-reveal className={className}>
      <motion.div
        ref={inner}
        initial={{ opacity: 0, clipPath: from === "top" ? "inset(0 0 100% 0)" : "inset(0 100% 0 0)" }}
        animate={seen ? { opacity: 1, clipPath: from === "top" ? "inset(0 0 0% 0)" : "inset(0 0% 0 0)" } : undefined}
        transition={{ duration, delay, ease: EASE }}
        // A clip-path left behind would cut off focus rings and shadows, so drop it once the reveal has finished.
        onAnimationComplete={() => {
          if (inner.current) inner.current.style.clipPath = "none";
        }}
      >
        {children}
      </motion.div>
    </Outer>
  );
}

/** Text rises out from behind an invisible edge. Wrap the text inside a heading: <h2><MaskRise>...</MaskRise></h2>. */
export function MaskRise({ delay = 0, amount = 0.4, children }: { delay?: number; amount?: number; children: React.ReactNode }) {
  const still = useReducedMotion();
  const outer = useRef<HTMLSpanElement>(null);
  const seen = useInView(outer, { once: true, amount });
  return (
    <span ref={outer} data-reveal className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
      <motion.span className="block" initial={still ? false : { y: "110%" }} animate={still || seen ? { y: "0%" } : undefined} transition={{ duration: 1, delay, ease: EASE }}>
        {children}
      </motion.span>
    </span>
  );
}

/**
 * A thin rule that draws itself across (axis x) or down (axis y). `className` sets the size and position of the track;
 * `lineClassName` colours the line itself, which is what grows.
 */
export function LineDraw({ axis = "x", delay = 0, className, lineClassName }: { axis?: "x" | "y"; delay?: number; className?: string; lineClassName?: string }) {
  const still = useReducedMotion();
  const outer = useRef<HTMLSpanElement>(null);
  const seen = useInView(outer, { once: true, amount: 0.5 });
  const key = axis === "x" ? "scaleX" : "scaleY";
  return (
    <span ref={outer} aria-hidden data-reveal className={cn("relative block", className)}>
      <motion.span
        className={cn("absolute inset-0", axis === "x" ? "origin-left" : "origin-top", lineClassName)}
        initial={still ? false : { [key]: 0 }}
        animate={still || seen ? { [key]: 1 } : undefined}
        transition={{ duration: 1, delay, ease: EASE }}
      />
    </span>
  );
}
