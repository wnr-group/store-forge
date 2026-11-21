import { BarChart3, Boxes, Building2, FolderTree, KeyRound, LayoutDashboard, Layers, Menu, Package, Palette, PenTool, FileText, ScrollText, Settings, ShieldCheck, UserCog, Users, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";
import { can, type Actor, type Permission } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; group?: string };

/** Permission a member needs to see a nav item. Items not listed here are visible to everyone. */
const NAV_PERMISSION: Record<string, Permission> = {
  // Design items are shown only to members who can change the design; their pages stay readable by URL (read-only editor).
  [ROUTES.templates]: "store:manage",
  [ROUTES.themeEditor]: "store:manage",
  [ROUTES.products]: "catalog:view",
  [ROUTES.categories]: "catalog:view",
  [ROUTES.collections]: "catalog:view",
  [ROUTES.inventory]: "catalog:view",
  [ROUTES.customers]: "customers:view",
  [ROUTES.analytics]: "orders:view",
};

/** hrefs the member may not open, for the sidebar to hide (the pages and the database check again). */
export const hiddenNavHrefs = (actor: Actor): string[] =>
  NAV_ITEMS.filter((i) => NAV_PERMISSION[i.href] && !can(actor, NAV_PERMISSION[i.href])).map((i) => i.href);

/** Only list pages that exist - no placeholder navigation. */
export const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.dashboard, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.templates, label: "Themes", icon: Palette, group: "Studio", exact: true },
  { href: ROUTES.themeEditor, label: "Customize", icon: PenTool, group: "Studio" },
  { href: ROUTES.products, label: "Products", icon: Package, group: "Studio" },
  { href: ROUTES.categories, label: "Categories", icon: FolderTree, group: "Studio" },
  { href: ROUTES.collections, label: "Collections", icon: Layers, group: "Studio" },
  { href: ROUTES.inventory, label: "Inventory", icon: Boxes, group: "Catalog" },
  { href: ROUTES.customers, label: "Customers", icon: Users, group: "Insights" },
  { href: ROUTES.analytics, label: "Analytics", icon: BarChart3, group: "Insights" },
  { href: ROUTES.pages, label: "Pages", icon: FileText, group: "Online Store" },
  { href: ROUTES.navigation, label: "Navigation", icon: Menu, group: "Online Store" },
  { href: ROUTES.settings, label: "Settings", icon: Settings, group: "Workspace" },
];

export const OWNER_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS.slice(0, -1),
  { href: ROUTES.team, label: "Team members", icon: UserCog, group: "Workspace" },
  NAV_ITEMS[NAV_ITEMS.length - 1],
];

/** Platform Admin area: companies only - no merchant data. */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: ROUTES.admin, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.adminCompanies, label: "Organizations", icon: Building2, group: "Platform" },
  { href: ROUTES.adminTeam, label: "Platform Team", icon: ShieldCheck, group: "Platform" },
  { href: ROUTES.adminActivity, label: "Activity & Audit Logs", icon: ScrollText, group: "Platform" },
  { href: ROUTES.adminUsage, label: "Usage & Analytics", icon: BarChart3, group: "Platform" },
  { href: ROUTES.adminSettings, label: "Settings", icon: Settings, group: "Platform" },
  { href: ROUTES.adminAccount, label: "My Account", icon: KeyRound, group: "Account" },
];

/** Serializable key: icon components cannot cross the server -> client boundary. */
export type NavKey = "merchant" | "owner" | "admin";
export const NAV_SETS: Record<NavKey, NavItem[]> = { merchant: NAV_ITEMS, owner: OWNER_NAV_ITEMS, admin: ADMIN_NAV_ITEMS };

/** What `navKey`'s member can open: the same set the sidebar lists, minus the hrefs hidden for them (e.g. by `hiddenNavHrefs`). */
export const visibleNavItems = (navKey: NavKey, hidden: readonly string[] = []): NavItem[] => NAV_SETS[navKey].filter((item) => !hidden.includes(item.href));

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
