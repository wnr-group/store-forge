import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS, hiddenNavHrefs, NAV_SETS, visibleNavItems } from "@/components/dashboard/nav-config";
import { ROUTES } from "@/config/app";
import type { Actor } from "@/lib/auth/permissions";

const owner: Actor = { role: "owner", permissions: {} };
const manager: Actor = { role: "admin", permissions: { products: "write", orders: "read", customers: "write", settings: "write", design: "publish" } };
/** Staff the owner has limited to customers: no catalog, no analytics. */
const customersOnly: Actor = { role: "staff", permissions: { customers: "read" } };
const noAccess: Actor = { role: "staff", permissions: {} };

const hrefs = (key: Parameters<typeof visibleNavItems>[0], actor: Actor) => visibleNavItems(key, hiddenNavHrefs(actor)).map((i) => i.href);

describe("Ctrl+K palette items (visibleNavItems)", () => {
  it("hides the sections a restricted member cannot open, like the sidebar", () => {
    const list = hrefs("merchant", customersOnly);
    for (const hidden of [ROUTES.products, ROUTES.categories, ROUTES.collections, ROUTES.inventory, ROUTES.analytics]) {
      expect(list, hidden).not.toContain(hidden);
    }
    expect(list).toContain(ROUTES.customers);
  });

  it("always keeps Overview and Settings, which every member can open", () => {
    const list = hrefs("merchant", noAccess);
    expect(list).toContain(ROUTES.dashboard);
    expect(list).toContain(ROUTES.settings);
    expect(list).not.toContain(ROUTES.customers);
  });

  it("lists everything for a member with full access", () => {
    expect(hrefs("merchant", manager)).toEqual(NAV_SETS.merchant.map((i) => i.href));
  });

  it("shows Team members to the owner only", () => {
    expect(hrefs("owner", owner)).toContain(ROUTES.team);
    expect(hrefs("merchant", manager)).not.toContain(ROUTES.team);
    expect(hrefs("merchant", customersOnly)).not.toContain(ROUTES.team);
  });

  it("matches what the sidebar renders for the same member (same items, same order)", () => {
    for (const [key, actor] of [["owner", owner], ["merchant", manager], ["merchant", customersOnly], ["merchant", noAccess]] as const) {
      const hidden = hiddenNavHrefs(actor);
      const sidebar = NAV_SETS[key].filter((item) => !hidden.includes(item.href)).map((i) => i.href);
      expect(hrefs(key, actor), `${key}/${actor.role}`).toEqual(sidebar);
    }
  });

  it("leaves the Platform Admin navigation as it is", () => {
    expect(visibleNavItems("admin")).toEqual(ADMIN_NAV_ITEMS);
    expect(visibleNavItems("admin").map((i) => i.href)).not.toContain(ROUTES.team);
  });
});

const settingsOnly: Actor = { role: "staff", permissions: { settings: "write", design: "write" } };
const productsOnly: Actor = { role: "staff", permissions: { products: "write" } };
const readOnlyAll: Actor = { role: "staff", permissions: { products: "read", settings: "read", orders: "read", customers: "read" } };
const groupOf = (group: string) => NAV_SETS.merchant.filter((i) => i.group === group).map((i) => i.href);

describe("Studio navigation group", () => {
  it("lists exactly Themes, Customize, Products, Categories, Collections, in that order and contiguously", () => {
    expect(groupOf("Studio")).toEqual([ROUTES.templates, ROUTES.themeEditor, ROUTES.products, ROUTES.categories, ROUTES.collections]);
    const idx = NAV_SETS.merchant.map((i, n) => (i.group === "Studio" ? n : -1)).filter((n) => n >= 0);
    expect(idx[idx.length - 1] - idx[0]).toBe(idx.length - 1);
  });
  it("keeps Pages and Navigation under Online Store and Inventory under Catalog", () => {
    expect(groupOf("Online Store")).toEqual([ROUTES.pages, ROUTES.navigation]);
    expect(groupOf("Catalog")).toEqual([ROUTES.inventory]);
  });
  // Themes and Customize moved from store:manage to the design module: they show for design:edit (write or publish), not for a
  // read-only design level, and no longer follow settings access (a settings:write member without a design level loses them).
  it("shows Themes and Customize only to members with design:edit", () => {
    for (const actor of [owner, manager, settingsOnly]) expect(hrefs("merchant", actor), actor.role).toEqual(expect.arrayContaining([ROUTES.templates, ROUTES.themeEditor]));
    for (const actor of [productsOnly, readOnlyAll, noAccess, customersOnly]) {
      const list = hrefs("merchant", actor);
      expect(list).not.toContain(ROUTES.templates);
      expect(list).not.toContain(ROUTES.themeEditor);
    }
  });
  it("shows catalogue items by products access, independent of design access", () => {
    expect(hrefs("merchant", productsOnly)).toEqual(expect.arrayContaining([ROUTES.products, ROUTES.categories, ROUTES.collections]));
    expect(hrefs("merchant", settingsOnly)).not.toContain(ROUTES.products);
  });
  it("does not hide Pages, Navigation or Settings", () => {
    for (const actor of [settingsOnly, productsOnly, noAccess]) expect(hrefs("merchant", actor)).toEqual(expect.arrayContaining([ROUTES.pages, ROUTES.navigation, ROUTES.settings]));
  });
  it("keeps Settings last so Team members lands before it", () => {
    expect(NAV_SETS.merchant[NAV_SETS.merchant.length - 1].href).toBe(ROUTES.settings);
    expect(NAV_SETS.owner.map((i) => i.href).slice(-2)).toEqual([ROUTES.team, ROUTES.settings]);
  });
});

describe("Studio navigation follows the design module", () => {
  const level = (design: "none" | "read" | "write" | "publish", extra: Actor["permissions"] = {}): Actor => ({ role: "staff", permissions: { ...extra, design } });
  const studio = [ROUTES.templates, ROUTES.themeEditor];
  it("hides Themes and Customize for design none and read, shows them for write and publish", () => {
    for (const d of ["none", "read"] as const) for (const h of studio) expect(hrefs("merchant", level(d)), `${d} ${h}`).not.toContain(h);
    for (const d of ["write", "publish"] as const) expect(hrefs("merchant", level(d)), d).toEqual(expect.arrayContaining(studio));
  });
  it("no longer depends on store settings access", () => {
    for (const h of studio) {
      expect(hrefs("merchant", level("none", { settings: "write" }))).not.toContain(h);
      expect(hrefs("merchant", level("write", { settings: "read" }))).toContain(h);
    }
  });
  it("is not unlocked by the attest or discard capabilities alone", () => {
    const capsOnly: Actor = { role: "staff", permissions: { design: "none" }, capabilities: ["attest", "discard"] };
    for (const h of studio) expect(hrefs("merchant", capsOnly)).not.toContain(h);
  });
});
