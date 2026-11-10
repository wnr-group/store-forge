"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isActive, NAV_SETS, type NavKey } from "./nav-config";

export function SidebarNav({ navKey, hidden = [], collapsed = false, onNavigate }: { navKey: NavKey; hidden?: string[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_SETS[navKey].filter((item) => !hidden.includes(item.href)).map((item, i, items) => {
        const heading = item.group && item.group !== items[i - 1]?.group ? item.group : null;
        const active = isActive(pathname, item);
        const link = (
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors duration-100 outline-none",
              "hover:bg-muted hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active ? "text-sidebar-accent-foreground" : "text-muted-foreground")} strokeWidth={1.75} aria-hidden />
            {collapsed ? null : <span className="truncate">{item.label}</span>}
          </Link>
        );
        if (!collapsed) {
          return (
            <div key={item.href}>
              {heading ? <p className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">{heading}</p> : null}
              {link}
            </div>
          );
        }
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
