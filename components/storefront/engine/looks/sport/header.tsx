"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useOptionalCart } from "@/components/storefront/cart/cart-provider";
import { useOptionalWishlist } from "@/components/storefront/wishlist/wishlist-provider";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { resolveImage } from "../../ui";
import type { SectionProps } from "..";
import { SportMotion } from "./motion";
import { useSearchSubmit } from "../../use-search-submit";
import { HEADLINE_FONT, SHELL } from "./ui";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const isShopUrl = (url: string) => /^\/(products)?(#products)?$/.test(url) && url !== "/";

type Item = { id: string; label: string; url: string; isButton: boolean };

/**
 * Sport header: the logo, the menu in spaced capitals with an underline on the current page, a pill search field, the
 * wishlist and bag with a count, and a dark call-to-action button (the first "button" block, for example Enquiry).
 * Hovering the Shop link opens a mega menu built from the store's own collections. On phones everything folds into a panel.
 */
export function SportHeader({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const logoWidth = (node.settings?.logoWidth as number) ?? 120;
  const sticky = Boolean(node.settings?.sticky ?? true);
  const showSeparator = Boolean(node.settings?.showSeparator ?? true);
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

  const pathname = usePathname() ?? "/";
  const cart = useOptionalCart();
  const wishlist = useOptionalWishlist();
  const [mega, setMega] = useState(false);
  const [open, setOpen] = useState(false);
  const collections = context.collections ?? [];

  // A new page (a search, a link in the menu) closes the phone menu: the header stays mounted while the route changes.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!mega && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMega(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mega, open]);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const logoSrc = resolveImage(node.settings?.logoImage).url ?? resolveImage(store.logo_path).url;
  const active = (url: string) => (url === "/" ? pathname === "/" : isShopUrl(url) ? pathname.startsWith("/products") : pathname.startsWith(url.replace(/#.*$/, "")));
  const iconBtn = cn("relative inline-flex size-11 items-center justify-center rounded-full text-primary transition-colors duration-200 hover:bg-[var(--surface)]", FOCUS);
  const countPill = "ml-1.5 inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[var(--surface)] px-2 text-[12px] font-semibold text-secondary";

  const searchHref = context.basePath ? `${context.basePath}/search` : "/search";
  const search = useSearchSubmit(searchHref);
  const megaImage = collections.find((c) => c.image_path);
  const browse = [
    { label: "Shop all", href: "/products" },
    { label: "Collections", href: "/collections" },
    { label: "Search", href: "/search" },
  ];
  const colsA = collections.slice(0, 5);
  const colsB = collections.slice(5, 10);

  return (
    <header className={cn("z-40 bg-background", sticky && "sticky top-0", showSeparator && "border-b border-border")} onMouseLeave={() => setMega(false)} {...sfProps}>
      <SportMotion />
      <div className={cn(SHELL, "flex h-[60px] items-center gap-3 sm:gap-6 lg:h-[72px] lg:gap-10")}>
        <Link href="/" aria-label={store.name} title={store.name} className={cn("flex shrink-0 items-center", FOCUS)}>
          {logoSrc ? (
            <Image src={logoSrc} alt={store.name} width={logoWidth} height={48} className="h-8 object-contain object-left lg:h-10" style={{ width: "auto", maxWidth: `${logoWidth}px` }} />
          ) : (
            <span className="text-[1.15rem] font-extrabold uppercase italic leading-none tracking-[-0.02em] text-primary sm:text-[1.5rem] lg:text-[1.75rem]" style={HEADLINE_FONT}>
              {store.name}
            </span>
          )}
        </Link>

        <nav aria-label="Main" className="mx-auto hidden h-full items-stretch gap-8 lg:flex xl:gap-10">
          {links.map((l) => {
            const isMega = isShopUrl(l.url);
            const on = active(l.url) || (isMega && mega);
            return (
              <Link
                key={l.id}
                href={l.url}
                onMouseEnter={() => setMega(isMega && collections.length > 0)}
                onFocus={() => setMega(isMega && collections.length > 0)}
                aria-expanded={isMega ? mega : undefined}
                className={cn("relative flex items-center text-[14px] font-medium uppercase tracking-[0.14em] transition-colors duration-200 focus-visible:outline-none", on ? "text-secondary" : "text-primary hover:text-secondary")}
              >
                {l.label}
                <span aria-hidden className={cn("absolute inset-x-0 bottom-[6px] h-0.5 origin-left bg-primary transition-transform duration-300", on ? "scale-x-100" : "scale-x-0")} />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center lg:ml-0 lg:gap-2">
          <form action={searchHref} method="get" role="search" onSubmit={search.onSubmit} aria-busy={search.pending} className={cn(search.pending && "opacity-70", "hidden h-11 w-[210px] items-center gap-3 rounded-full bg-[var(--surface)] px-4 text-primary focus-within:ring-2 focus-within:ring-primary/30 xl:flex 2xl:w-[260px]")}>
            <Search className="size-[19px] shrink-0 text-secondary" strokeWidth={1.75} aria-hidden />
            <input name="q" type="search" placeholder="Search products" aria-label="Search the store" className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-muted-foreground" />
          </form>
          <Link href="/search" aria-label="Search the store" className={cn(iconBtn, "xl:hidden")}>
            <Search className="size-5" strokeWidth={1.75} aria-hidden />
          </Link>
          {wishlist ? (
            <Link href="/wishlist" prefetch={false} aria-label={wishlist.ready && wishlist.count > 0 ? `Wishlist, ${wishlist.count} ${wishlist.count === 1 ? "item" : "items"}` : "Wishlist"} className={cn(iconBtn, "hidden sm:inline-flex")}>
              <Heart className="size-5" strokeWidth={1.75} aria-hidden />
              {wishlist.ready && wishlist.count > 0 ? <span aria-hidden className="absolute right-1 top-1 flex size-[17px] items-center justify-center rounded-full bg-accent text-[10px] font-bold leading-none text-primary">{wishlist.count > 99 ? "99+" : wishlist.count}</span> : null}
            </Link>
          ) : null}
          {cart ? (
            <button type="button" onClick={cart.openDrawer} aria-label={cart.ready && cart.count > 0 ? `Bag, ${cart.count} ${cart.count === 1 ? "item" : "items"}` : "Bag"} className={cn("inline-flex h-11 items-center rounded-full pl-2.5 pr-1.5 text-primary transition-colors hover:bg-[var(--surface)]", FOCUS)}>
              <ShoppingBag className="size-5" strokeWidth={1.75} aria-hidden />
              <span aria-hidden className={countPill}>{cart.ready ? cart.count : 0}</span>
            </button>
          ) : null}
          {cta ? (
            <Link href={cta.url} className={cn("ml-2 hidden h-11 items-center rounded-[0.5rem] bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover,var(--primary))] sm:inline-flex", FOCUS)}>
              {cta.label}
            </Link>
          ) : null}
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="storefront-menu" onClick={() => setOpen((v) => !v)} className={cn(iconBtn, "lg:hidden")}>
            {open ? <X className="size-5" strokeWidth={1.75} aria-hidden /> : <Menu className="size-5" strokeWidth={1.75} aria-hidden />}
          </button>
        </div>
      </div>

      {mega ? (
        <div className="absolute inset-x-0 top-full hidden border-t border-border bg-[var(--surface)] shadow-[0_30px_60px_-30px_rgba(13,16,51,0.25)] lg:block" onMouseEnter={() => setMega(true)}>
          <div className={cn(SHELL, "grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))_220px] gap-10 py-12")}>
            <div className="pr-6">
              <p className="text-[2.25rem] font-extrabold uppercase leading-none tracking-[-0.02em] text-primary" style={HEADLINE_FONT}>
                Shop
              </p>
              {store.description ? <p className="mt-5 line-clamp-4 max-w-sm text-[17px] leading-8 text-muted-foreground">{store.description}</p> : null}
              <Link href="/products" onClick={() => setMega(false)} className="mt-8 inline-flex items-center gap-2 border-b-2 border-primary pb-1 text-[14px] font-bold uppercase tracking-[0.14em] text-primary">
                Shop all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <MegaColumn title="Browse" links={browse} onNavigate={() => setMega(false)} />
            <MegaColumn title="Collections" links={colsA.map((c) => ({ label: c.name, href: `/collections/${c.slug}` }))} onNavigate={() => setMega(false)} />
            {colsB.length > 0 ? <MegaColumn title="More" links={colsB.map((c) => ({ label: c.name, href: `/collections/${c.slug}` }))} onNavigate={() => setMega(false)} /> : <span />}
            {megaImage ? (
              <Link href="/products" onClick={() => setMega(false)} className="block">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-[0.75rem] bg-muted">
                  <Image src={publicImageUrl(megaImage.image_path)!} alt="" fill sizes="220px" className="object-cover" />
                </span>
                <span className="mt-3 block text-[13px] font-bold uppercase tracking-[0.14em] text-primary">Shop all</span>
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      ) : null}

      {open ? (
        <nav id="storefront-menu" aria-label="Main" className="border-t border-border bg-background lg:hidden" onClick={() => setOpen(false)}>
          <div className={cn(SHELL, "flex flex-col py-3")}>
            <form action={searchHref} method="get" role="search" onSubmit={search.onSubmit} aria-busy={search.pending} onClick={(e) => e.stopPropagation()} className={cn(search.pending && "opacity-70", "mb-2 flex h-12 items-center gap-3 rounded-full bg-[var(--surface)] px-4")}>
              <Search className="size-[18px] text-secondary" aria-hidden />
              <input name="q" type="search" placeholder="Search products" aria-label="Search the store" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
            </form>
            {items.map((l) => (
              <Link key={l.id} href={l.url} className="border-b border-border py-4 text-[14px] font-medium uppercase tracking-[0.14em] text-primary last:border-b-0">
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function MegaColumn({ title, links, onNavigate }: { title: string; links: { label: string; href: string }[]; onNavigate: () => void }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-secondary">{title}</p>
      <ul className="mt-6 space-y-4">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} onClick={onNavigate} className="text-[18px] text-primary transition-colors hover:text-secondary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
