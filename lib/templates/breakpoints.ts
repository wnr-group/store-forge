/**
 * Fixed responsive breakpoints for the template engine (decisions D24, D26; AC-REN-017).
 * Plain constants shared between preview iframe, CSS generator, and storefront rendering.
 */
import type { ResponsiveValue } from "./engine/descriptors";

export const BREAKPOINTS = Object.freeze({
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const);

export type BreakpointKey = keyof typeof BREAKPOINTS;

export const BREAKPOINT_KEYS = Object.freeze(Object.keys(BREAKPOINTS) as BreakpointKey[]);

export const BREAKPOINT_MEDIA_QUERIES = Object.freeze({
  mobile: `(max-width: ${BREAKPOINTS.tablet - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
} as const);

export function isBreakpoint(value: unknown): value is BreakpointKey {
  return typeof value === "string" && (BREAKPOINT_KEYS as readonly string[]).includes(value);
}

/**
 * Resolves a scalar or responsive value `{ base, tablet?, mobile? }` for a target device viewport.
 * Cascades gracefully: mobile falls back to tablet, then base; tablet falls back to base.
 */
export function resolveResponsiveValue<T>(
  value: ResponsiveValue<T> | undefined | null,
  device: BreakpointKey = "desktop",
): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object" && value !== null && "base" in value) {
    const resp = value as { base: T; tablet?: T; mobile?: T };
    if (device === "mobile") {
      return resp.mobile ?? resp.tablet ?? resp.base;
    }
    if (device === "tablet") {
      return resp.tablet ?? resp.base;
    }
    return resp.base;
  }

  return value as T;
}
