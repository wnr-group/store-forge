import type { CSSProperties } from "react";

/** Spreads on an element to fade and rise it into view, `step` indexes it in a row so siblings arrive one after another. */
export const rise = (step = 0) => ({ "data-sf-reveal": "up", style: { ["--delay" as string]: `${Math.min(step, 8) * 70}ms` } as CSSProperties });

const TINTS = ["#ffe89a", "#c9cdf5", "#cdeadb", "#ffd8c7", "#cfe6f6", "#e6d5f4"];
/** The pastel a card fills with on hover (pair with the `sf-tint` class). */
export const tintStyle = (i: number) => ({ ["--sf-tint" as string]: TINTS[i % TINTS.length] }) as CSSProperties;
