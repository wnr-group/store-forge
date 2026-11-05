"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

/** Below `md` the nav links collapse into this disclosure. It closes on Escape and when a link is chosen. */
export function MobileMenu({ links }: { links: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="landing-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-lp-border bg-white text-lp-heading outline-none transition-colors hover:bg-lp-soft focus-visible:ring-2 focus-visible:ring-lp-primary"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open ? (
        <nav id="landing-mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-full border-b border-lp-border bg-lp-bg px-4 pt-2 pb-5 shadow-sm">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium text-lp-heading hover:bg-lp-soft">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
