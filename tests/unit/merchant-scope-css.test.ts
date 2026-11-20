import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static guards for the merchant-scoped styling (F2, F4). These read the source files; they do NOT prove how the page
 * renders. The rendered result (computed styles, contrast on real surfaces) is proven by the Playwright specs
 * studio-scope / studio-evidence, which run in a real browser.
 */
const read = (p: string) => readFileSync(p, "utf8");
const css = read("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, ""); // comments would otherwise be read as part of the next selector

/** Naive splitter, enough for this file's flat rules (the innermost block of any nested at-rule is matched too). */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));

function luminance(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("merchant scope CSS (static guards)", () => {
  it("assigns --control-h and --error-text only under [data-area=merchant]", () => {
    const assigning = rules.filter((r) => /--(control-h|error-text)\s*:/.test(r.body));
    expect(assigning.length).toBeGreaterThan(0);
    for (const r of assigning) expect(r.selector, r.selector).toContain('[data-area="merchant"]');
  });

  it("keeps the global --error token values (light and dark)", () => {
    expect(css).toMatch(/:root\s*\{[^}]*--error:\s*#dc5353;/);
    expect(css).toMatch(/\.dark\s*\{[^}]*--error:\s*#e05252;/);
  });

  it("overrides only the text colour of .text-error, so error borders and fills are untouched", () => {
    const rule = rules.find((r) => r.selector === '[data-area="merchant"] .text-error');
    expect(rule?.body.replace(/\s/g, "")).toBe("color:var(--error-text);");
  });

  it("dark mode: merchant error TEXT is #e46666, on <html> (portals) and on the wrapper", () => {
    const dark = rules.find((r) => r.selector.includes('.dark[data-area="merchant"]'));
    expect(dark?.selector).toContain('.dark [data-area="merchant"]');
    expect(dark?.body).toContain("--error-text: #e46666");
  });

  it("#e46666 reaches 4.5:1 on every dark surface the app paints, including 5% error banners over each; the old #e05252 did not", () => {
    const darkBlock = [...css.matchAll(/\.dark\s*\{([^}]*)\}/g)].map((m) => m[1]).find((body) => body.includes("--popover:"));
    expect(darkBlock, "the .dark token block").toBeTruthy();
    const token = (name: string) => new RegExp("--" + name + String.raw`:\s*(#[0-9a-fA-F]{6})`).exec(darkBlock!)?.[1] as string;
    const surfaces = Object.fromEntries(["background", "card", "popover", "muted"].map((k) => [k, token(k)]));
    const globalError = token("error");
    expect(globalError, "the global dark --error token is unchanged (borders and fills)").toBe("#e05252");
    const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const banner = (bg: string) => "#" + channels(globalError).map((v, i) => Math.round(v * 0.05 + channels(bg)[i] * 0.95).toString(16).padStart(2, "0")).join("");
    const all: Record<string, string> = { ...surfaces };
    for (const [k, v] of Object.entries(surfaces)) all["banner on " + k] = banner(v);
    for (const [name, bg] of Object.entries(all)) expect(ratio("#e46666", bg), name).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#e05252", surfaces.popover), "documents why the dark text colour changed (dialog surface)").toBeLessThan(4.5);
  });

  it("the approved merchant error colour is #b83232", () => {
    const scope = rules.find((r) => r.selector === '[data-area="merchant"]');
    expect(scope?.body).toContain("--error-text: #b83232");
    expect(scope?.body).toContain("--control-h: 2rem");
  });

  it("#b83232 reaches 4.5:1 on the light surfaces the page paints (calculation; the browser spec measures the rendered pair)", () => {
    const err = "#dc5353";
    const tint = (bg: string) => {
      const f = [1, 3, 5].map((i) => parseInt(err.slice(i, i + 2), 16));
      const b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
      return "#" + f.map((v, i) => Math.round(v * 0.05 + b[i] * 0.95).toString(16).padStart(2, "0")).join("");
    };
    for (const [name, bg] of Object.entries({ white: "#ffffff", page: "#f7f8fa", muted: "#f3f4f6", bannerOnPage: tint("#f7f8fa"), bannerOnWhite: tint("#ffffff") })) {
      expect(ratio("#b83232", bg), name).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(err, "#ffffff"), "documents why the override exists").toBeLessThan(4.5);
  });

  it("Input and NativeSelect fall back to their previous heights when no scope sets --control-h", () => {
    expect(read("components/ui/input.tsx")).toContain("h-[var(--control-h,2rem)]");
    expect(read("components/ui/native-select.tsx")).toContain("h-[var(--control-h,2.25rem)]");
  });

  it("the Ctrl+K trigger is 32px and the palette is built from navKey and the hidden list", () => {
    const src = read("components/dashboard/command-search.tsx");
    expect(src).toContain("h-8 w-8");
    expect(src).not.toMatch(/\bh-9\b/);
    expect(src).toContain("visibleNavItems(navKey, hidden)");
  });

  it("the default Button definition was not touched (its default size is still h-8)", () => {
    expect(read("components/ui/button.tsx")).toMatch(/default:\s*\n?\s*"h-8 gap-1\.5 px-3/);
  });
});

describe("merchant sidebar scroll cue and compact density (static guards)", () => {
  const sidebarRules = rules.filter((r) => r.selector.includes("[data-sidebar-scroll]"));

  it("every rule that targets the sidebar scroll container is scoped to the merchant dashboard", () => {
    expect(sidebarRules.length).toBeGreaterThan(0);
    for (const r of sidebarRules) expect(r.selector, r.selector).toContain('[data-area="merchant"]');
  });

  it("the scroll cue uses local covers over scroll shadows, in light and dark", () => {
    const light = sidebarRules.find((r) => r.selector === '[data-area="merchant"] [data-sidebar-scroll]' && r.body.includes("background"));
    const dark = sidebarRules.find((r) => r.selector.includes(".dark") && r.body.includes("background"));
    for (const r of [light, dark]) {
      expect(r?.body).toContain("no-repeat local");
      expect(r?.body).toContain("no-repeat scroll");
    }
  });

  it("compact density only applies below 830px of viewport height and keeps links at 32px", () => {
    expect(css).toMatch(/@media \(max-height: 830px\)\s*\{[\s\S]*nav a\s*\{\s*height: 2rem;/);
  });

  it("AppShell marks both scroll containers (desktop sidebar and mobile drawer)", () => {
    const shell = read("components/dashboard/app-shell.tsx");
    expect(shell.match(/data-sidebar-scroll/g)?.length).toBe(2);
  });
});

describe("Studio polish: skip link, Add team member footer, dialog focus return (static guards)", () => {
  it("the Add team member footer rule is scoped to the merchant dashboard and that dialog only", () => {
    const rule = rules.find((r) => r.selector.includes('[data-dialog="add-member"]'));
    expect(rule?.selector).toContain('[data-area="merchant"]');
    expect(rule?.selector).toContain('[data-slot="dialog-footer"]');
    expect(rule?.body).toContain("position: sticky");
    expect(read("components/team/team-manager.tsx")).toContain('data-dialog="add-member"');
  });

  it("the skip link is merchant-only: rendered from the dashboard layout, not from the shared AppShell", () => {
    expect(read("app/(dashboard)/dashboard/layout.tsx")).toContain("<SkipLink />");
    expect(read("components/dashboard/app-shell.tsx")).not.toContain("SkipLink");
    const src = read("components/dashboard/skip-link.tsx");
    expect(src).toContain('href="#main"');
    expect(src).toContain("sr-only focus:not-sr-only");
  });

  it("the main landmark takes script focus without a ring", () => {
    expect(css).toMatch(/\[data-area="merchant"\] main#main:focus\s*\{\s*outline: none;/);
  });

  it("all five button-opened dialogs use the focus-return hook, and Admin's AddMemberDialog caller does not", () => {
    for (const f of ["components/categories/category-manager.tsx", "components/inventory/inventory-table.tsx", "components/customers/customer-actions.tsx", "components/team/team-manager.tsx"]) {
      expect(read(f), f).toContain("useReturnFocus(");
    }
    expect(read("components/admin/add-company-member.tsx")).not.toContain("finalFocus");
  });
});
