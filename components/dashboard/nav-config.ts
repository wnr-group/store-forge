import { BarChart3, Boxes, Megaphone, ShoppingBasket, TicketPercent, Building2, CreditCard, Landmark, ShoppingCart, Truck, FolderTree, KeyRound, LayoutDashboard, Layers, Menu, Package, Palette, PenTool, FileText, Plug, ScrollText, Settings, ShieldCheck, UserCog, Users, Activity, Gauge, Receipt, SlidersHorizontal, Tags, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";
import { can, type Actor, type Permission } from "@/lib/auth/permissions";
export { hiddenFeatureHrefs } from "@/lib/billing/features";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; group?: string };

/** Permission a member needs to see a nav item. Items not listed here are visible to everyone. */
const NAV_PERMISSION: Record<string, Permission> = {
  [ROUTES.products]: "catalog:view",
  [ROUTES.categories]: "catalog:view",
  [ROUTES.collections]: "catalog:view",
  [ROUTES.inventory]: "catalog:view",
  [ROUTES.customers]: "customers:view",
  [ROUTES.analytics]: "orders:view",
  [ROUTES.orders]: "orders:view",
  [ROUTES.shipping]: "shipping:view",
  [ROUTES.taxes]: "tax:view",
  [ROUTES.integrations]: "integrations:view",
  [ROUTES.discounts]: "marketing:view",
  [ROUTES.campaigns]: "marketing:view",
  [ROUTES.abandonedCarts]: "marketing:view",
};

/** hrefs the member may not open, for the sidebar to hide (the pages and the database check again). */
export const hiddenNavHrefs = (actor: Actor): string[] =>
  NAV_ITEMS.filter((i) => NAV_PERMISSION[i.href] && !can(actor, NAV_PERMISSION[i.href])).map((i) => i.href);

/** Only list pages that exist - no placeholder navigation. */
export const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.dashboard, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.orders, label: "Orders", icon: ShoppingCart, group: "Sales" },
  { href: ROUTES.shipping, label: "Shipping", icon: Truck, group: "Sales" },
  { href: ROUTES.taxes, label: "Taxes", icon: Landmark, group: "Sales" },
  { href: ROUTES.products, label: "Products", icon: Package, group: "Catalog" },
  { href: ROUTES.categories, label: "Categories", icon: FolderTree, group: "Catalog" },
  { href: ROUTES.collections, label: "Collections", icon: Layers, group: "Catalog" },
  { href: ROUTES.inventory, label: "Inventory", icon: Boxes, group: "Catalog" },
  { href: ROUTES.discounts, label: "Discounts", icon: TicketPercent, group: "Marketing" },
  { href: ROUTES.campaigns, label: "Campaigns", icon: Megaphone, group: "Marketing" },
  { href: ROUTES.abandonedCarts, label: "Abandoned carts", icon: ShoppingBasket, group: "Marketing" },
  { href: ROUTES.customers, label: "Customers", icon: Users, group: "Insights" },
  { href: ROUTES.analytics, label: "Analytics", icon: BarChart3, group: "Insights" },
  { href: ROUTES.templates, label: "Themes", icon: Palette, group: "Online Store", exact: true },
  { href: ROUTES.themeEditor, label: "Customize", icon: PenTool, group: "Online Store" },
  { href: ROUTES.pages, label: "Pages", icon: FileText, group: "Online Store" },
  { href: ROUTES.navigation, label: "Navigation", icon: Menu, group: "Online Store" },
  { href: ROUTES.integrations, label: "Integrations", icon: Plug, group: "Workspace" },
  { href: ROUTES.settings, label: "Settings", icon: Settings, group: "Workspace" },
];

export const OWNER_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS.slice(0, -1),
  { href: ROUTES.team, label: "Team members", icon: UserCog, group: "Workspace" },
  { href: ROUTES.billing, label: "Plan & billing", icon: Receipt, group: "Workspace" },
  { href: ROUTES.payments, label: "Payments", icon: CreditCard, group: "Workspace" },
  NAV_ITEMS[NAV_ITEMS.length - 1],
];

/** Platform administration. Which entries a person sees depends on their platform role (see `hiddenAdminHrefs`); the pages and the API check again. */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: ROUTES.admin, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.adminCompanies, label: "Organizations", icon: Building2, group: "Platform" },
  { href: ROUTES.adminPlans, label: "Subscription Plans", icon: Tags, group: "Platform" },
  { href: ROUTES.adminEntitlements, label: "Feature Entitlements", icon: SlidersHorizontal, group: "Platform" },
  { href: ROUTES.adminLimits, label: "Usage & Limits", icon: Gauge, group: "Platform" },
  { href: ROUTES.adminBilling, label: "Billing & Invoices", icon: Receipt, group: "Finance" },
  { href: ROUTES.adminTeam, label: "Platform Administrators", icon: ShieldCheck, group: "Administration" },
  { href: ROUTES.adminActivity, label: "Audit Logs", icon: ScrollText, group: "Administration" },
  { href: ROUTES.adminMonitoring, label: "System Monitoring", icon: Activity, group: "Administration" },
  { href: ROUTES.adminUsage, label: "Usage & Analytics", icon: BarChart3, group: "Administration" },
  { href: ROUTES.adminSettings, label: "Settings", icon: Settings, group: "Administration" },
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
