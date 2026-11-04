import { LayoutDashboard, Package, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Only list pages that exist - no placeholder navigation. */
export const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.dashboard, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ROUTES.products, label: "Products", icon: Package },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
