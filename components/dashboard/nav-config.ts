import { BarChart3, Boxes, Building2, FolderTree, LayoutDashboard, Layers, Package, Palette, PlusCircle, Settings, UserCog, Users, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; group?: string };

/** Only list pages that exist - no placeholder navigation. */
export const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.dashboard, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.products, label: "Products", icon: Package, group: "Catalog" },
  { href: ROUTES.categories, label: "Categories", icon: FolderTree, group: "Catalog" },
  { href: ROUTES.collections, label: "Collections", icon: Layers, group: "Catalog" },
  { href: ROUTES.inventory, label: "Inventory", icon: Boxes, group: "Catalog" },
  { href: ROUTES.customers, label: "Customers", icon: Users, group: "Insights" },
  { href: ROUTES.analytics, label: "Analytics", icon: BarChart3, group: "Insights" },
  { href: ROUTES.templates, label: "Templates", icon: Palette, group: "Workspace" },
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
  { href: ROUTES.adminCompanies, label: "Companies", icon: Building2, exact: true, group: "Platform" },
  { href: ROUTES.adminNewCompany, label: "Create company", icon: PlusCircle, group: "Platform" },
];

/** Serializable key: icon components cannot cross the server -> client boundary. */
export type NavKey = "merchant" | "owner" | "admin";
export const NAV_SETS: Record<NavKey, NavItem[]> = { merchant: NAV_ITEMS, owner: OWNER_NAV_ITEMS, admin: ADMIN_NAV_ITEMS };

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
