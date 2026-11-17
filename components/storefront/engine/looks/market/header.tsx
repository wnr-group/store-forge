"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Heart, Home, LayoutGrid, Menu, Search, ShoppingCart, Sparkles, X } from "lucide-react";
import { useOptionalCart } from "@/components/storefront/cart/cart-provider";
import { useOptionalWishlist } from "@/components/storefront/wishlist/wishlist-provider";
import { cn } from "@/lib/utils";
import { resolveImage } from "../../ui";
import type { SectionProps } from "..";
import { useSearchSubmit } from "../../use-search-submit";
import { FOCUS, Logo, WRAP } from "./ui";

type Item = { id: string; label: string; url: string; isButton: boolean };

const NAV_LINK = "relative flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-primary-foreground/90 transition-colors hover:bg-white/10";
const COUNT = "absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground tabular-nums";

/**
 * Market header: a dark bar with the store's mark, a wide search field with an orange button, the wishlist and the cart with
 * a count; under it a second dark row with "All categories", the store's collections and the call-to-action (the first
 * "button" block) on the right. On phones the menu is a drawer from the left and a tab bar sits at the foot of the screen.
 */
export function MarketHeader({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const logoWidth = (node.settings?.logoWidth as number) ?? 140;
  const sticky = Boolean(node.settings?.sticky ?? true);
  const blocks = node.blocks ?? {};
  const items: Item[] = (node.block_order ?? Object.keys(blocks)).flatMap((id): Item[] => {
    const b = blocks[id];
    if (!b || (b.disabled && context.mode === "public")) return [];
    if (b.type === "link") return [{ id, label: String(b.settings?.label ?? "Link"), url: String(b.settings?.url ?? "/") || "/", isButton: false }];
    if (b.type === "button") return [{ id, label: String(b.settings?.label ?? "Enquiry"), url: String(b.settings?.link ?? "/contact") || "/", isButton: true }];
    return [];
  });
  const links = items.filter((i) => !i.isButton);
  const cta = items.find((i) => i.isButton);
  const collections = context.collections ?? [];

  const pathname = usePathname() ?? "/";
  const cart = useOptionalCart();
  const wishlist = useOptionalWishlist();
  const [open, setOpen] = useState(false);

  // A new page (a search, a link in the menu) closes the phone menu: the header stays mounted while the route changes.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const logoSrc = resolveImage(node.settings?.logoImage).url ?? resolveImage(store.logo_path).url;
  const searchHref = context.basePath ? `${context.basePath}/search` : "/search";
  const search = useSearchSubmit(searchHref);
  const cartCount = cart?.ready ? cart.count : 0;
  const wishCount = wishlist?.ready ? wishlist.count : 0;

  const mark = logoSrc ? (
    <Image src={logoSrc} alt={store.name} width={logoWidth} height={40} className="h-8 object-contain object-left" style={{ width: "auto", maxWidth: `${logoWidth}px` }} />
  ) : (
    <Logo name={store.name} />
  );

  // The second row: the store's collections (the first dozen); a store with none shows its menu links instead.
  const row = collections.length > 0 ? collections.slice(0, 12).map((c) => ({ key: c.slug, label: c.name, href: `/collections/${c.slug}` })) : links.map((l) => ({ key: l.id, label: l.label, href: l.url }));

  const tabs = [
    { href: "/", label: "Home", icon: Home, badge: 0 },
    { href: "/collections", label: "Categories", icon: LayoutGrid, badge: 0 },
    { href: "/search", label: "Search", icon: Search, badge: 0 },
    ...(wishlist ? [{ href: "/wishlist", label: "Wishlist", icon: Heart, badge: wishCount }] : []),
  ];

  return (
    <>
      <header className={cn("z-40 bg-primary text-primary-foreground", sticky && "sticky top-0")} {...sfProps}>
        <div className={WRAP}>
          <div className="flex h-[60px] items-center gap-2">
            <button type="button" aria-label="Open menu" aria-expanded={open} aria-controls="storefront-menu" onClick={() => setOpen(true)} className={cn("grid size-9 place-items-center rounded-md hover:bg-white/10 lg:hidden", FOCUS)}>
              <Menu className="size-5" aria-hidden />
            </button>
            <Link href="/" aria-label={store.name} title={store.name} className={cn("mr-1 shrink-0 rounded-md", FOCUS)}>
              {mark}
            </Link>
            <form action={searchHref} method="get" role="search" onSubmit={search.onSubmit} aria-busy={search.pending} className={cn(search.pending && "opacity-80", "mx-1 flex h-10 min-w-0 max-w-3xl flex-1 overflow-hidden rounded-lg bg-white ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-accent")}>
              <input name="q" type="search" placeholder={`Search ${store.name}`} aria-label="Search the store" className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-primary outline-none placeholder:text-muted-foreground" />
              <button type="submit" aria-label="Search" className="grid w-12 shrink-0 place-items-center bg-accent text-accent-foreground transition-colors hover:brightness-95">
                <Search className="size-[18px]" aria-hidden />
              </button>
            </form>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {wishlist ? (
                <Link href="/wishlist" prefetch={false} aria-label={wishCount > 0 ? `Wishlist, ${wishCount} ${wishCount === 1 ? "item" : "items"}` : "Wishlist"} className={cn(NAV_LINK, "hidden sm:flex", FOCUS)}>
                  <Heart className="size-[18px]" aria-hidden />
                  <span className="hidden xl:inline">Wishlist</span>
                  {wishCount > 0 ? <span aria-hidden className={COUNT}>{wishCount > 99 ? "99+" : wishCount}</span> : null}
                </Link>
              ) : null}
              {cart ? (
                <button type="button" onClick={cart.openDrawer} aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"} className={cn(NAV_LINK, "pr-2.5", FOCUS)}>
                  <ShoppingCart className="size-[19px]" aria-hidden />
                  <span className="hidden xl:inline">Cart</span>
                  {cartCount > 0 ? <span aria-hidden className={COUNT}>{cartCount > 99 ? "99+" : cartCount}</span> : null}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <nav aria-label="Main" className="hidden border-t border-white/10 bg-[color-mix(in_srgb,var(--primary)_90%,#fff)] lg:block">
          <div className={cn(WRAP, "flex h-9 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
            <Link href="/collections" className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-[13px] font-semibold text-primary-foreground hover:bg-white/10", FOCUS)}>
              <LayoutGrid className="size-3.5" aria-hidden /> All categories
            </Link>
            {row.map((r) => {
              const on = pathname === r.href || (r.href !== "/" && pathname.startsWith(`${r.href}/`));
              return (
                <Link key={r.key} href={r.href} aria-current={on ? "page" : undefined} className={cn("whitespace-nowrap rounded px-2 py-1 text-[13px] transition-colors", on ? "bg-white/15 font-medium text-primary-foreground" : "text-primary-foreground/80 hover:bg-white/10", FOCUS)}>
                  {r.label}
                </Link>
              );
            })}
            {cta ? (
              <Link href={cta.url} className={cn("ml-auto flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[13px] font-semibold text-accent hover:bg-white/10", FOCUS)}>
                <Sparkles className="size-3.5" aria-hidden /> {cta.label}
              </Link>
            ) : null}
          </div>
        </nav>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden" id="storefront-menu">
          <div className="absolute inset-0 bg-primary/60" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Menu" className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] animate-in slide-in-from-left flex-col bg-white duration-200 motion-reduce:animate-none">
            <div className="flex h-14 items-center justify-between bg-primary px-4 text-primary-foreground">
              {mark}
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className={cn("grid size-9 place-items-center rounded-md hover:bg-white/10", FOCUS)}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2" onClick={() => setOpen(false)}>
              {collections.length > 0 ? (
                <>
                  <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shop by category</p>
                  {collections.map((c) => (
                    <DrawerLink key={c.slug} href={`/collections/${c.slug}`}>{c.name}</DrawerLink>
                  ))}
                  <div className="my-2 border-t border-border" />
                </>
              ) : null}
              {items.map((l) => (
                <DrawerLink key={l.id} href={l.url}>{l.label}</DrawerLink>
              ))}
              {wishlist ? <DrawerLink href="/wishlist">Wishlist</DrawerLink> : null}
            </div>
          </div>
        </div>
      ) : null}

      <nav aria-label="Shortcuts" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white lg:hidden">
        <ul className="flex">
          {tabs.map((t) => {
            const on = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link href={t.href} aria-current={on ? "page" : undefined} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors", on ? "text-secondary" : "text-muted-foreground")}>
                  <t.icon className="size-[19px]" aria-hidden />
                  {t.label}
                  {t.badge > 0 ? <span aria-hidden className="absolute right-[calc(50%-18px)] top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">{t.badge}</span> : null}
                </Link>
              </li>
            );
          })}
          {cart ? (
            <li className="flex-1">
              <button type="button" onClick={cart.openDrawer} className="relative flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground">
                <ShoppingCart className="size-[19px]" aria-hidden />
                Cart
                {cartCount > 0 ? <span aria-hidden className="absolute right-[calc(50%-18px)] top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">{cartCount}</span> : null}
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}

function DrawerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-2.5 text-sm text-primary hover:bg-muted">
      {children}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
