import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS, hiddenNavHrefs, NAV_SETS, visibleNavItems } from "@/components/dashboard/nav-config";
import { ROUTES } from "@/config/app";
import type { Actor } from "@/lib/auth/permissions";

const owner: Actor = { role: "owner", permissions: {} };
const manager: Actor = { role: "admin", permissions: { products: "write", orders: "read", customers: "write", settings: "write" } };
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
