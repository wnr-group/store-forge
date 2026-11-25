import { useId } from "react";
import { cn } from "@/lib/utils";

const BRAND_FONT = "var(--font-manrope), ui-sans-serif, system-ui, sans-serif";

/**
 * The Kanova Store logo, drawn to the proportions of the logo artwork: the K shopping-bag mark is an image
 * (public/kanova-mark.png) and "Kanova", the TM and "Store" are live SVG text, each fitted to the width it has in the artwork.
 * Coordinates are the artwork's own pixels (origin at the mark's top left, 282 high). The text takes the current text colour,
 * so set it with a text-* class (navy on light backgrounds, white on dark ones) and the size with an h-* class.
 */
export function KanovaLockup({ className }: { className?: string }) {
  const dash = useId();
  return (
    <svg viewBox="0 0 894 282" aria-hidden focusable="false" className={cn("w-auto shrink-0", className)}>
      <defs>
        <linearGradient id={dash} x1="0" x2="1">
          <stop offset="0" stopColor="#f86f18" />
          <stop offset="1" stopColor="#fa9c2c" />
        </linearGradient>
      </defs>
      <image href="/kanova-mark.png" x="0" y="1.5" width="230" height="279" />
      <g fill="currentColor" style={{ fontFamily: BRAND_FONT }}>
        <text x="285" y="191" fontSize="158" fontWeight="800" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" textLength="541" lengthAdjust="spacingAndGlyphs">Kanova</text>
        <text x="834" y="120" fontSize="46" fontWeight="700" textLength="54" lengthAdjust="spacingAndGlyphs">TM</text>
        <text x="415" y="265" fontSize="63" fontWeight="500" textLength="245" lengthAdjust="spacingAndGlyphs">Store</text>
      </g>
      <rect x="285" y="230" width="108" height="11" rx="5.5" fill={`url(#${dash})`} />
    </svg>
  );
}
