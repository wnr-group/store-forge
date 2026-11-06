"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sticky header frame: a frosted-glass bar that tightens and gains depth once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none",
        scrolled ? "border-lp-border bg-lp-bg/80 shadow-[0_8px_30px_-12px_rgba(18,40,31,0.18)]" : "border-transparent bg-lp-bg/60",
      )}
    >
      <div className={cn("transition-[height] duration-300 motion-reduce:transition-none", scrolled ? "[--nav-h:3.5rem]" : "[--nav-h:4.5rem]")}>{children}</div>
    </header>
  );
}
