import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => { const { createElement: h } = await import("react"); return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) }; });
vi.mock("next/link", async () => { const { createElement: h } = await import("react"); return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) }; });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

import { PublishedView } from "@/components/storefront/published-view";

/** Keep in sync with THROWING_VARIANT in tests/e2e/studio-storefront-errors.spec.ts and the fault proxy modes. */
export const VARIANTS = { "null-document": null, "string-document": "not a document", "bad-order": { sections: {}, order: 5 }, "null-section": { sections: { a: null }, order: ["a"] }, "bad-blocks": { sections: { a: { type: "rich-text", settings: {}, blocks: {}, block_order: null } }, order: ["a"] } } as const;
export const THROWING_VARIANT: keyof typeof VARIANTS = "bad-order";

const store = { name: "Shop", slug: "shop", currency: "INR", products: [], collections: [] } as never;
const render = (document: unknown) =>
  renderToStaticMarkup(createElement(PublishedView, { store, frame: { layout: { theme: { settings: {} }, groups: {} }, collections: [] } as never, document: document as never }));

describe("malformed published documents (premise of the storefront error E2E)", () => {
  it("lists which variants throw while rendering", () => {
    const thrown = Object.entries(VARIANTS).filter(([, doc]) => { try { render(doc); return false; } catch { return true; } }).map(([k]) => k);
    console.log("variants that throw:", thrown.join(", ") || "none");
    expect(thrown.length).toBeGreaterThan(0);
  });
  it("the variants the E2E uses really throw", () => {
    expect(() => render(VARIANTS[THROWING_VARIANT])).toThrow();
    expect(() => render(VARIANTS["null-section"])).toThrow();
  });
});
