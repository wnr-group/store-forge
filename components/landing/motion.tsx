"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MotionConfig, motion, useScroll, useSpring, useTransform, type HTMLMotionProps, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/**
 * True when the visitor prefers reduced motion. The server snapshot is always false, so the server HTML and the first
 * browser render are identical (no hydration mismatch); parallax then switches off straight after hydration.
 */
function useStill() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
}

/** A calm, decelerating curve used by every reveal, so the page moves with one rhythm. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Honour the visitor's "reduce motion" setting for every animation inside the landing page. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type Tag = "div" | "li" | "ul" | "ol" | "section" | "figure" | "p" | "span";

type RevealProps = Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "viewport" | "transition"> & {
  as?: Tag;
  /** Seconds to wait before this element starts; use index * 0.1 to stagger a group. */
  delay?: number;
  /** Distance, in px, the element rises while it fades in. */
  y?: number;
  /** Start slightly smaller and grow to full size (e.g. 0.95). */
  from?: number;
  /** Fraction of the element that must be visible before it plays. */
  amount?: number;
};

/**
 * Fades an element in and lifts it into place once, when it scrolls into view. Server components can wrap any markup in it.
 * `data-reveal` lets the <noscript> rule in the page keep content visible when JavaScript is off.
 */
export function Reveal({ as = "div", delay = 0, y = 28, from, amount = 0.2, className, children, ...rest }: RevealProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      data-reveal
      initial={{ opacity: 0, y, scale: from ?? 1 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount, margin: "0px 0px -6% 0px" }}
      transition={{ duration: 0.85, delay, ease: EASE }}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/**
 * Parallax for a photograph: the image drifts slower than the page as its frame scrolls past. The image is enlarged a
 * little so the drift never reveals an edge. The parent must be `relative overflow-hidden`; put an <Image fill> inside.
 */
export function Parallax({ children, className, distance = 36, zoom = 1.14 }: { children: React.ReactNode; className?: string; distance?: number; zoom?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStill();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  return (
    <div ref={ref} className={cn("absolute inset-0", className)}>
      <motion.div style={{ y: still ? 0 : y, scale: still ? 1 : zoom }} className="absolute inset-0">
        {children}
      </motion.div>
    </div>
  );
}

/** A thin gold bar along the very top of the page that fills as you read down it. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  return <motion.div style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-lp-accent" aria-hidden />;
}

/** Text that eases up and fades as the hero scrolls away. Hand it the hero's ref via `target`. */
export function useHeroScroll(target: React.RefObject<HTMLElement | null>) {
  const still = useStill();
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  return { y: still ? 0 : lift, opacity };
}

/* ------------------------------------------------------------------ stacking cards */

const StackContext = createContext<{ progress: MotionValue<number>; total: number } | null>(null);

/** Wraps a list of sticky cards. As later cards slide over earlier ones, the earlier cards ease back slightly. */
export function StackList({ children, total, className }: { children: React.ReactNode; total: number; className?: string }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <StackContext.Provider value={{ progress: scrollYProgress, total }}>
      <ol ref={ref} className={className}>
        {children}
      </ol>
    </StackContext.Provider>
  );
}

export function StackItem({ index, className, style, children }: { index: number; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ctx = useContext(StackContext);
  if (!ctx) throw new Error("StackItem must be rendered inside a StackList");
  const still = useStill();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { progress, total } = ctx;
  const sinkTo = 1 - 0.045 * (total - 1 - index);
  // The cards only stack (and so only need to ease back) on large screens
  const scale = useTransform(progress, [index / total, 1], [1, wide && !still ? sinkTo : 1]);
  return (
    <motion.li style={{ ...style, scale, transformOrigin: "50% 0%" }} className={className}>
      {children}
    </motion.li>
  );
}
