import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/config/app";
import { MobileMenu } from "./mobile-menu";
import { BrandLogo, Container, lpButton } from "./ui";

/** In-page anchors only: every destination below exists. */
export const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#features", label: "Features" },
  { href: "#solutions", label: "Solutions" },
] as const;

export function AnnouncementBar() {
  return (
    <div className="bg-lp-primary text-white">
      <Container className="flex min-h-9 items-center justify-center py-2 text-center text-[13px]">
        <p className="text-pretty">
          <span className="font-medium">Introducing StoreForge, a commerce platform by WNR</span>
          <span className="hidden text-white/80 sm:inline"> — everything you need to build and grow your online store.</span>
        </p>
      </Container>
    </div>
  );
}

// Sign-in links are plain anchors: /login redirects signed-in users to /dashboard, and a redirected client-side
// <Link> navigation fails in React's Flight client ("chunk.reason.enqueueModel is not a function").
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-lp-border bg-lp-bg">
      <Container className="flex h-16 items-center justify-between gap-6">
        <a href="#top" aria-label="StoreForge by WNR, back to top" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lp-primary">
          <BrandLogo />
        </a>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-lp-text transition-colors hover:bg-lp-soft hover:text-lp-heading">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={ROUTES.login} className="hidden rounded-md px-3 py-2 text-sm font-medium text-lp-heading transition-colors hover:bg-lp-soft sm:inline-flex">
            Login
          </a>
          <a href={ROUTES.login} className={lpButton("primary", "hidden h-10 px-4 sm:inline-flex")}>
            Get Started
          </a>
          <MobileMenu links={NAV_LINKS} loginHref={ROUTES.login} />
        </div>
      </Container>
    </header>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "#platform", label: "Overview" },
      { href: "#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Features",
    links: [
      { href: "#features", label: "Store management" },
      { href: "#features", label: "Products and inventory" },
      { href: "#features", label: "Orders and customers" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "#solutions", label: "For online sellers" },
      { href: "#solutions", label: "For shoppers" },
      { href: ROUTES.login, label: "Login" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-lp-border bg-white">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <BrandLogo />
            <p className="mt-4 text-sm leading-6 text-lp-text">
              StoreForge is a multi-tenant commerce platform built by WNR. Each company gets its own catalog, inventory, customers, team and a public storefront on its own subdomain.
            </p>
            <a href={ROUTES.login} className={lpButton("secondary", "mt-5 h-10")}>
              Login <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-lp-heading">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-lp-text transition-colors hover:text-lp-heading">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-lp-border pt-6 text-xs text-lp-text sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} WNR. StoreForge is a WNR product. All rights reserved.</p>
          <p>
            Photography from{" "}
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              Unsplash
            </a>{" "}
            and{" "}
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              Pexels
            </a>
            .
          </p>
        </div>
      </Container>
    </footer>
  );
}
