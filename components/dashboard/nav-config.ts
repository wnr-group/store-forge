import { BarChart3, Boxes, FolderTree, LayoutDashboard, Layers, Package, Settings, Users, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Only list pages that exist - no placeholder navigation. */
export const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.dashboard, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.products, label: "Products", icon: Package },
  { href: ROUTES.categories, label: "Categories", icon: FolderTree },
  { href: ROUTES.collections, label: "Collections", icon: Layers },
  { href: ROUTES.inventory, label: "Inventory", icon: Boxes },
  { href: ROUTES.customers, label: "Customers", icon: Users },
  { href: ROUTES.analytics, label: "Analytics", icon: BarChart3 },
  { href: ROUTES.settings, label: "Settings", icon: Settings },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
