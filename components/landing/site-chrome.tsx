import Link from "next/link";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";
import { Reveal } from "./motion";
import { BrandLogo, Container } from "./ui";

/** In-page anchors only: every destination below exists. */
export const NAV_LINKS = [
  { href: "/#platform", label: "Platform" },
  { href: "/#features", label: "Features" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function AnnouncementBar() {
  return (
    <div className="bg-lp-deep text-white">
      <Container className="flex min-h-9 items-center justify-center py-2 text-center text-[13px]">
        <p className="text-pretty">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-lp-accent align-middle" aria-hidden />
          <span className="font-semibold">Introducing StoreForge</span>
          <span className="hidden text-white/80 sm:inline"> — everything you need to build and grow your online store.</span>
        </p>
      </Container>
    </div>
  );
}

export function SiteHeader() {
  return (
    <HeaderShell>
      <Container className="flex h-(--nav-h) items-center justify-between gap-6 transition-[height] duration-300 motion-reduce:transition-none">
        <Link href="/" aria-label="StoreForge, home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lp-primary">
          <BrandLogo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-lp-text outline-none transition-colors duration-200 hover:bg-lp-soft hover:text-lp-heading focus-visible:ring-2 focus-visible:ring-lp-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <MobileMenu links={NAV_LINKS} />
      </Container>
    </HeaderShell>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/#platform", label: "Overview" },
      { href: "/#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Features",
    links: [
      { href: "/#features", label: "Store management" },
      { href: "/#features", label: "Products and inventory" },
      { href: "/#features", label: "Orders and customers" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/#solutions", label: "For online sellers" },
      { href: "/#solutions", label: "For shoppers" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative bg-lp-deep text-white">
      <span aria-hidden className="lp-gold-rule absolute inset-x-0 top-0 h-px" />
      <Container className="py-14">
        <Reveal y={20} className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-sm">
            <BrandLogo light />
            <p className="mt-4 text-sm leading-6 text-white/65">
              StoreForge is a commerce platform for online sellers. Each company gets its own catalog, inventory, customers, team and a public storefront on its own subdomain.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-lp-accent-light">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-white/65 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </Reveal>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} StoreForge. All rights reserved.</p>
          <p>
            Powered by{" "}
            <a href="https://www.wnradvisory.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white underline-offset-4 hover:underline">
              WNR Group
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
