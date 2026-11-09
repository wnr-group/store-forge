import { describe, expect, it } from "vitest";
import {
  BREAKPOINTS,
  BREAKPOINT_MEDIA_QUERIES,
  isBreakpoint,
  resolveResponsiveValue,
} from "@/lib/templates/breakpoints";

describe("Breakpoints foundation [AC-REN-017]", () => {
  it("defines the exact fixed breakpoints from decisions D24 and D26", () => {
    expect(BREAKPOINTS.mobile).toBe(390);
    expect(BREAKPOINTS.tablet).toBe(768);
    expect(BREAKPOINTS.desktop).toBe(1280);
    expect(Object.isFrozen(BREAKPOINTS)).toBe(true);
  });

  it("defines standard media query strings for mobile, tablet, and desktop", () => {
    expect(BREAKPOINT_MEDIA_QUERIES.mobile).toBe("(max-width: 767px)");
    expect(BREAKPOINT_MEDIA_QUERIES.tablet).toBe("(min-width: 768px) and (max-width: 1279px)");
    expect(BREAKPOINT_MEDIA_QUERIES.desktop).toBe("(min-width: 1280px)");
    expect(Object.isFrozen(BREAKPOINT_MEDIA_QUERIES)).toBe(true);
  });

  it("isBreakpoint validates keys", () => {
    expect(isBreakpoint("mobile")).toBe(true);
    expect(isBreakpoint("tablet")).toBe(true);
    expect(isBreakpoint("desktop")).toBe(true);
    expect(isBreakpoint("widescreen")).toBe(false);
    expect(isBreakpoint(null)).toBe(false);
    expect(isBreakpoint(1280)).toBe(false);
  });

  it("resolveResponsiveValue resolves scalar and responsive objects", () => {
    expect(resolveResponsiveValue(42, "desktop")).toBe(42);
    expect(resolveResponsiveValue(42, "mobile")).toBe(42);

    const responsive = { base: 100, tablet: 80, mobile: 50 };
    expect(resolveResponsiveValue(responsive, "desktop")).toBe(100);
    expect(resolveResponsiveValue(responsive, "tablet")).toBe(80);
    expect(resolveResponsiveValue(responsive, "mobile")).toBe(50);
  });

  it("resolveResponsiveValue cascades mobile -> tablet -> base", () => {
    const onlyBase = { base: "default" };
    expect(resolveResponsiveValue(onlyBase, "desktop")).toBe("default");
    expect(resolveResponsiveValue(onlyBase, "tablet")).toBe("default");
    expect(resolveResponsiveValue(onlyBase, "mobile")).toBe("default");

    const baseAndTablet = { base: "base", tablet: "tablet" };
    expect(resolveResponsiveValue(baseAndTablet, "mobile")).toBe("tablet");

    const baseAndMobile = { base: "base", mobile: "mobile" };
    expect(resolveResponsiveValue(baseAndMobile, "tablet")).toBe("base");
    expect(resolveResponsiveValue(baseAndMobile, "mobile")).toBe("mobile");
  });
});
