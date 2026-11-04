"use client";

import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES, SIDEBAR_COOKIE } from "@/config/app";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

/** Server-rendered slots; each has a full and a compact (icon-only) rendering. */
type Props = {
  switcher: { full: React.ReactNode; compact: React.ReactNode };
  footer: { full: React.ReactNode; compact: React.ReactNode };
  header: React.ReactNode;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
};

/** Responsive shell: collapsible sidebar on desktop, drawer below `lg`. Slots are server-rendered. */
export function AppShell({ switcher, header, footer, defaultCollapsed = false, children }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawer, setDrawer] = useState(false);

  const toggle = () =>
    setCollapsed((c) => {
      // Cookie (not localStorage) so the server can render the right width on first paint.
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });

  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-dvh bg-background">
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
            collapsed ? "w-[3.75rem]" : "w-60",
          )}
        >
          <div className={cn("flex h-14 items-center border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
            {collapsed ? <Logo href={ROUTES.dashboard} className="text-white [&>span:last-child]:hidden" /> : <Logo href={ROUTES.dashboard} className="text-white" />}
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
            {collapsed ? switcher.compact : switcher.full}
            <SidebarNav collapsed={collapsed} />
          </div>
          <div className="border-t border-sidebar-border p-2.5">{collapsed ? footer.compact : footer.full}</div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="absolute -right-3.5 top-[3.9rem] z-10 size-7 rounded-full border bg-card text-foreground shadow-xs hover:bg-accent"
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
        </aside>

        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-72">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main dashboard navigation</SheetDescription>
            <div className="flex h-14 items-center border-b border-sidebar-border px-3">
              <Logo href={ROUTES.dashboard} className="text-white" />
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
              {switcher.full}
              <SidebarNav onNavigate={() => setDrawer(false)} />
            </div>
            <div className="border-t border-sidebar-border p-2.5">{footer.full}</div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
              <Menu aria-hidden />
            </Button>
            {header}
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
