"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SubNavItem = { href: string; label: string; exact?: boolean };

/** Section tabs under a page header (Payments, Shipping). Plain links, so each tab is its own server-rendered page. */
export function SubNav({ items, label }: { items: SubNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mt-1 mb-5 flex gap-1 overflow-x-auto border-b">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors", active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
