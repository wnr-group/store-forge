"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Marks the merchant dashboard so its scoped styles (the `[data-area="merchant"]` rules in globals.css) apply here and
 * not in Platform Admin or on the login screen, which keep the global defaults.
 *
 * Dialogs, menus and popovers render in a portal outside this wrapper, so the marker is also put on <html> while the
 * dashboard is mounted, and removed again when it unmounts.
 */
export function MerchantScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.area = "merchant";
    return () => {
      if (root.dataset.area === "merchant") delete root.dataset.area;
    };
  }, []);

  // On a short screen the sidebar scrolls. A fresh page load starts it at the top, which can hide the current section, so
  // bring the active item into view (only scrolls when it is actually clipped).
  useEffect(() => {
    document.querySelector('[data-sidebar-scroll] a[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <div data-area="merchant" className="contents">
      {children}
    </div>
  );
}
