import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Shopping wording in the Theme editor: the bag drawer and a card's Add to bag button stand for theme-wide settings. They carry a
 * marker in the editor and the preview only; clicking one opens Theme > Shopping wording at that field; and a product card's
 * Elements edit the same Add to bag label. The pieces are tested as pure logic and as static markup; how it feels is checked by hand.
 */

const cartState = {
  storeSlug: "shop",
  currency: "INR",
  preview: true,
  lines: [] as unknown[],
  count: 0,
  subtotalMinor: 0,
  ready: true,
  drawerOpen: true,
  openDrawer: () => {},
  closeDrawer: () => {},
  add: () => true,
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
  revalidate: async () => null,
  toast: null,
  dismissToast: () => {},
  notify: () => {},
};
const wishlistState = { ready: true, items: [] as unknown[], count: 0, has: () => false, toggle: () => true, revalidate: async () => null };

vi.mock("@/components/storefront/cart/cart-provider", () => ({ useOptionalCart: () => cartState, useCart: () => cartState }));
vi.mock("@/components/storefront/wishlist/wishlist-provider", () => ({ useOptionalWishlist: () => wishlistState }));
vi.mock("@/components/storefront/tracking/tracking-provider", () => ({ useTracker: () => ({ track: () => {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("@/app/s/[slug]/cart/actions", () => ({ checkCartAction: async () => [], checkpointCartAction: async () => undefined }));
vi.mock("@/app/s/[slug]/wishlist/actions", () => ({ checkWishlistAction: async () => [] }));

import { CartChrome } from "@/components/storefront/cart/cart-drawer";
import { StorefrontContext } from "@/components/storefront/engine/context";
import { CardActions } from "@/components/storefront/engine/looks/boutique/card-actions";
import { MarketProductCard } from "@/components/storefront/engine/looks/market/product-card";
import { CardElements, type CardContext } from "@/components/themes/editor/card-elements";
import { SettingsPanel } from "@/components/themes/editor/settings-panel";
import { THEME_TARGET_ATTR, themeTargetMarker } from "@/lib/editor/theme-target-marker";
import { parseThemeTarget, themeFieldId, themeTargetAt, type ClickableElement } from "@/lib/editor/theme-target";
import { cardHasAddToBagLabel } from "@/lib/templates/card-parts";

const read = (file: string) => readFileSync(join(__dirname, "..", "..", file), "utf8");

const product = { name: "Linen Dress", slug: "linen", price_minor: 1000, available: true, image_path: null } as never;
const inMode = (mode: string, look: string, child: React.ReactElement) =>
  renderToStaticMarkup(createElement(StorefrontContext.Provider, { value: { store: { name: "S", slug: "shop", currency: "INR" }, collections: [], theme: { settings: { brand: { look } } }, mode, basePath: "" } as never }, child));

describe("the marker", () => {
  it("is written in the editor and the preview, and never on the live storefront", () => {
    expect(themeTargetMarker("editor", "productCards", "emptyCartTitle")).toEqual({ [THEME_TARGET_ATTR]: "productCards.emptyCartTitle" });
    expect(themeTargetMarker("preview", "productCards", "addToBagLabel")).toEqual({ [THEME_TARGET_ATTR]: "productCards.addToBagLabel" });
    for (const mode of ["public", undefined, "", "other"]) expect(themeTargetMarker(mode, "productCards", "addToBagLabel")).toEqual({});
  });

  it("names only a setting the theme really has", () => {
    expect(parseThemeTarget("productCards.addToBagLabel")).toEqual({ group: "productCards", key: "addToBagLabel" });
    expect(parseThemeTarget("productCards.emptyCartTitle")).toEqual({ group: "productCards", key: "emptyCartTitle" });
    for (const bad of [null, undefined, "", "productCards", ".x", "productCards.nope", "nope.addToBagLabel", "colors.addToBagLabel"]) expect(parseThemeTarget(bad)).toBeNull();
  });
});

describe("the bag drawer", () => {
  const drawer = (mode: string) => inMode(mode, "boutique", createElement(CartChrome));
  it("carries the marker for Empty cart title in the editor and in the preview", () => {
    for (const mode of ["editor", "preview"]) {
      const html = drawer(mode);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('data-sf-theme="productCards.emptyCartTitle"');
    }
  });
  it("is exactly the same markup on the live storefront as before: no marker", () => {
    expect(drawer("public")).not.toContain("data-sf-theme");
    expect(renderToStaticMarkup(createElement(CartChrome))).not.toContain("data-sf-theme");
  });
  it("puts the marker on the panel only, so the page behind it is not taken for the drawer", () => {
    expect((drawer("editor").match(/data-sf-theme=/g) ?? []).length).toBe(1);
  });
});

describe("a product card's Add to bag button", () => {
  const card = (mode: string, look = "boutique") => inMode(mode, look, createElement(CardActions, { product, href: "/products/linen" }));
  it("carries the marker for Add to bag label in the editor and in the preview", () => {
    for (const mode of ["editor", "preview"]) {
      const button = card(mode).match(/<button[^>]*>Add to bag<\/button>/)?.[0] ?? "";
      expect(button).toContain('data-sf-theme="productCards.addToBagLabel"');
    }
  });
  it("has none on the live storefront", () => {
    expect(card("public")).toContain("Add to bag");
    expect(card("public")).not.toContain("data-sf-theme");
  });
  it("only the button carries it, not the heart", () => {
    expect((card("editor").match(/data-sf-theme=/g) ?? []).length).toBe(1);
  });
  it("Market's cards are untouched: no marker and no Add to bag in any mode", () => {
    for (const mode of ["editor", "preview", "public"]) {
      const html = inMode(mode, "market", createElement(MarketProductCard, { product, currency: "INR", href: "/products/linen" }));
      expect(html, mode).not.toContain("data-sf-theme");
      expect(html, mode).not.toContain("Add to bag");
    }
  });
});

/** Just enough of an element for the click logic: a node with a parent, attributes and a tag. */
type Fake = ClickableElement & { tag: string; attrs: Record<string, string>; parent: Fake | null };
function el(tag: string, attrs: Record<string, string> = {}, parent: Fake | null = null): Fake {
  const node: Fake = {
    tag,
    attrs,
    parent,
    getAttribute: (name) => attrs[name] ?? null,
    contains: (other) => {
      for (let n = other as Fake | null; n; n = n.parent) if (n === node) return true;
      return false;
    },
    closest: (selector) => {
      const wanted = selector.split(",").map((s) => s.trim());
      for (let n: Fake | null = node; n; n = n.parent) {
        if (wanted.some((s) => (s.startsWith("[") ? s.slice(1, -1) in n!.attrs : s === n!.tag))) return n;
      }
      return null;
    },
  };
  return node;
}

describe("clicking a marked element in the preview", () => {
  const frame = el("div");
  const drawerPanel = el("div", { [THEME_TARGET_ATTR]: "productCards.emptyCartTitle" }, frame);

  it("opens that theme setting, from anywhere on the drawer panel", () => {
    expect(themeTargetAt(drawerPanel)).toEqual({ group: "productCards", key: "emptyCartTitle" });
    expect(themeTargetAt(el("p", {}, drawerPanel))).toEqual({ group: "productCards", key: "emptyCartTitle" });
  });
  it("opens Add to bag label when the marked element is the button itself", () => {
    const button = el("button", { [THEME_TARGET_ATTR]: "productCards.addToBagLabel" }, el("div", { "data-sf-section": "grid" }, frame));
    expect(themeTargetAt(button)).toEqual({ group: "productCards", key: "addToBagLabel" });
    expect(themeTargetAt(el("span", {}, button))).toEqual({ group: "productCards", key: "addToBagLabel" });
  });
  it("leaves a link or button inside the drawer to do its own job (close, View bag)", () => {
    expect(themeTargetAt(el("button", {}, drawerPanel))).toBeNull();
    expect(themeTargetAt(el("svg", {}, el("button", {}, drawerPanel)))).toBeNull();
    expect(themeTargetAt(el("a", {}, drawerPanel))).toBeNull();
  });
  it("is nothing for an unmarked element, a section, or a marker that names no setting", () => {
    expect(themeTargetAt(el("h2", {}, el("div", { "data-sf-section": "hero" }, frame)))).toBeNull();
    expect(themeTargetAt(el("div", { [THEME_TARGET_ATTR]: "productCards.bogus" }, frame))).toBeNull();
  });
  it("maps to the field the Theme panel focuses", () => {
    expect(themeFieldId({ group: "productCards", key: "emptyCartTitle" })).toBe("productCards.emptyCartTitle");
    expect(themeFieldId({ group: "productCards", key: "addToBagLabel" })).toBe("productCards.addToBagLabel");
  });
});

describe("the editor wiring", () => {
  it("the frame checks for a theme marker before it looks for a section, and only with the inspector on", () => {
    const src = read("components/themes/theme-frame.tsx");
    const inspector = src.indexOf("if (!inspector)");
    const marker = src.indexOf("themeTargetAt(target)");
    const section = src.indexOf('target.closest<HTMLElement>("[data-sf-section]")');
    expect(inspector).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(inspector);
    expect(section).toBeGreaterThan(marker);
    expect(src).toContain("onThemeTarget");
  });

  it("the shell opens the Theme tab on the settings panel and focuses the clicked field", () => {
    const src = read("components/themes/editor/editor-shell.tsx");
    const body = src.slice(src.indexOf("const onThemeTarget = useCallback"), src.indexOf("Text edited directly on the page"));
    expect(body).toContain('setLeftTab("theme")');
    expect(body).toContain('setMobileTab("settings")');
    expect(body).toContain("setFocusSetting({ key: themeFieldId(target)");
    expect(src).toContain("onThemeTarget={onThemeTarget}");
  });
});

describe("Theme > Shopping wording", () => {
  const themeDoc = { schemaVersion: 1, settings: { brand: { look: "boutique" }, productCards: { emptyCartTitle: "Basket empty", addToBagLabel: "Buy now" } } };
  const panel = () =>
    renderToStaticMarkup(
      createElement(SettingsPanel, {
        state: { docs: { theme: { templateId: "theme", kind: "theme_settings", document: themeDoc } } } as never,
        mode: "theme",
        themeDocId: "theme",
        disabled: false,
        problems: {},
        focusSetting: { key: "productCards.emptyCartTitle", nonce: 1 },
        onFocusConsumed: () => {},
      } as never),
    );

  it("gives every wording field an id the jump from the preview can find", () => {
    const html = panel();
    for (const key of ["addToBagLabel", "emptyCartTitle", "emptyCartMessage", "emptyWishlistTitle", "emptyWishlistMessage"]) expect(html).toContain(`data-setting-id="productCards.${key}"`);
  });
  it("shows the stored value in the field the jump lands on", () => {
    const html = panel();
    expect(html).toContain("Basket empty");
    expect(html).toContain("Buy now");
  });
  it("explains that the cart title serves the cart page and the drawer, and the label every card and the product page", () => {
    const html = panel();
    expect(html).toMatch(/Empty cart title applies to both the cart page and the cart drawer/);
    expect(html).toMatch(/Add to bag label to all product cards and the product detail page/);
  });
  it("keeps one setting per wording key: the drawer and the card add no settings of their own", () => {
    const html = panel();
    expect((html.match(/data-setting-id="productCards\./g) ?? []).length).toBe(5);
  });
  it("the settings panel reads the focus request and consumes it", () => {
    const src = read("components/themes/editor/settings-panel.tsx");
    expect(src).toContain("focusSetting={focusSetting} onFocusConsumed={onFocusConsumed}");
    expect(src).toContain("onFocusConsumed();");
  });
});

describe("a product card's Elements: Add to bag label", () => {
  const written: string[] = [];
  const context = (look: string, extra: Partial<CardContext> = {}): CardContext => ({ look, descriptionDefault: true, addToBagLabel: { value: "Buy now", onChange: (v) => written.push(v) }, ...extra });
  const elements = (settings: Record<string, unknown> | undefined, ctx: CardContext, kind: "product" | "collection" = "product") =>
    renderToStaticMarkup(createElement(CardElements, { kind, settings, context: ctx, disabled: false, onChange: () => {} }));

  it("appears when Quick add is on, with the store-wide value and a note", () => {
    const html = elements({ showQuickAdd: true }, context("boutique"));
    expect(html).toContain('data-testid="card-add-to-bag-label"');
    expect(html).toContain("Add to bag label");
    expect(html).toContain("Buy now");
    expect(html).toContain("applies to all product cards and the product detail page");
  });
  it("is there when the section never chose (Quick add is on by default), for Boutique and Sport", () => {
    for (const look of ["boutique", "sport"]) expect(elements(undefined, context(look))).toContain("card-add-to-bag-label");
  });
  it("is not shown when Quick add is off", () => {
    expect(elements({ showQuickAdd: false }, context("boutique"))).not.toContain("card-add-to-bag-label");
  });
  it("is not shown for Market (its cards have no Add to bag button), the standard look, collection cards, or without a theme to write to", () => {
    expect(elements({ showQuickAdd: true }, context("market"))).not.toContain("card-add-to-bag-label");
    expect(elements({ showQuickAdd: true }, context("standard"))).not.toContain("card-add-to-bag-label");
    expect(elements({ showQuickAdd: true }, context(undefined as never))).not.toContain("card-add-to-bag-label");
    expect(elements({ showQuickAdd: true }, context("boutique"), "collection")).not.toContain("card-add-to-bag-label");
    expect(elements({ showQuickAdd: true }, context("boutique", { addToBagLabel: undefined }))).not.toContain("card-add-to-bag-label");
  });
  it("is the same field as the theme's: it comes from the theme descriptor, not a copy", () => {
    const src = read("components/themes/editor/card-elements.tsx");
    expect(src).toContain("themeSettingDescriptors.find");
    expect(src).toContain('"addToBagLabel"');
  });
  it("the shell writes it to the theme document's productCards.addToBagLabel", () => {
    const src = read("components/themes/editor/editor-shell.tsx");
    expect(src).toContain('setThemeSetting(s, themeId, WORDING_GROUP, "addToBagLabel", value)');
    expect(src).toContain("const stored = (themeDoc as");
  });
  it("only Boutique and Sport have the label to edit", () => {
    expect(["boutique", "sport", "market", "standard", undefined].map((l) => cardHasAddToBagLabel(l))).toEqual([true, true, false, false, false]);
  });
});
