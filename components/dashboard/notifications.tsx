import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROUTES } from "@/config/app";
import { cn } from "@/lib/utils";
import { listInventory } from "@/services/inventory.service";

/**
 * Real alerts only: stock that needs attention. Streams in via <Suspense> so the
 * extra queries never delay the page behind it.
 */
export async function Notifications({ canViewStock = true }: { canViewStock?: boolean }) {
  // A member without catalogue access has no stock to be told about, and the read would be refused (the whole page failed).
  const [out, low] = canViewStock
    ? await Promise.all([listInventory({ q: "", stock: "out", page: 1 }), listInventory({ q: "", stock: "low", page: 1 })])
    : [{ total: 0 }, { total: 0 }];
  const items = [
    ...(out.total ? [{ key: "out", text: `${out.total} item${out.total === 1 ? " is" : "s are"} out of stock`, href: `${ROUTES.inventory}?stock=out` }] : []),
    ...(low.total ? [{ key: "low", text: `${low.total} item${low.total === 1 ? " is" : "s are"} running low`, href: `${ROUTES.inventory}?stock=low` }] : []),
  ];
  const count = items.length;

  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")} aria-label={count ? `Notifications, ${count} new` : "Notifications"}>
        <Bell aria-hidden />
        {count ? <span className="absolute top-1 right-1 size-2 rounded-full bg-warning ring-2 ring-background" aria-hidden /> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <p className="border-b px-3 py-2 text-sm font-medium">Notifications</p>
        {count === 0 ? (
          <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success-text" aria-hidden /> You are all caught up.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.key}>
                <Link href={n.href} className="block px-3 py-2.5 text-sm hover:bg-muted/60">
                  {n.text}
                  <span className="block text-xs text-muted-foreground">View in inventory</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function NotificationsFallback() {
  return (
    <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "pointer-events-none opacity-50")} aria-hidden>
      <Bell />
    </span>
  );
}
