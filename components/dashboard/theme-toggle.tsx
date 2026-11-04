"use client";

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Theme } from "@/lib/theme/script";
import { setTheme, useTheme } from "@/lib/theme/store";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Light / Dark / System menu. The trigger icon is swapped with CSS (`dark:` variants), not state,
 * so the server HTML matches the pre-paint theme script and nothing flickers on load.
 */
export function ThemeToggle() {
  const theme = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative overflow-hidden")} aria-label="Change theme">
        <Sun className="size-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" aria-hidden />
        <Moon className="absolute size-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={(e) => {
              // Reveal from the menu item you clicked (falls back to the top-right corner for keyboard use).
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const fromPointer = e.clientX || e.clientY;
              setTheme(value, fromPointer ? { x: e.clientX, y: e.clientY } : { x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }}
          >
            <Icon aria-hidden /> {label}
            {theme === value ? <Check className="ml-auto" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
