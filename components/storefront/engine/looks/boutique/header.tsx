"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useOptionalWishlist } from "@/components/storefront/wishlist/wishlist-provider";
import { useSignedIn } from "@/lib/auth/use-signed-in";
import { useOptionalCart } from "@/components/storefront/cart/cart-provider";
import { StoreAccessLink } from "@/components/storefront/store-access-link";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import { resolveImage } from "../../ui";
import { SHELL } from "./shell";
import type { SectionProps } from "..";
import { initialsOf } from "./initials";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
const NAV_LINKS =
  "[&_a]:relative [&_a]:py-1.5 [&_a]:text-[11px] [&_a]:font-normal [&_a]:uppercase [&_a]:tracking-[0.2em] [&_a]:text-foreground/80 [&_a]:no-underline [&_a:hover]:no-underline [&_a:focus-visible]:no-underline [&_a]:transition-colors [&_a]:duration-200 [&_a:hover]:text-foreground [&_a]:after:absolute [&_a]:after:inset-x-0 [&_a]:after:bottom-0 [&_a]:after:h-px [&_a]:after:origin-left [&_a]:after:scale-x-0 [&_a]:after:bg-current [&_a]:after:transition-transform [&_a]:after:duration-300 [&_a:hover]:after:scale-x-100 motion-reduce:[&_a]:after:transition-none";

/**
 * Boutique header: monogram and name on the left, the menu centred in small spaced capitals, search and sign-in on the
 * right, on an ivory bar with a hairline. On phones the menu folds into a panel under the bar. The bag is left out until
 * the store has a cart to open (see docs/boutique-look.md).
 */
export function BoutiqueHeader({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const logoWidth = (node.settings?.logoWidth as number) ?? 120;
  const sticky = Boolean(node.settings?.sticky ?? true);
  const showSeparator = Boolean(node.settings?.showSeparator ?? true);
  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);
  const [open, setOpen] = useState(false);
  const cart = useOptionalCart();
  const wishlist = useOptionalWishlist();
  const signedIn = useSignedIn() === true;

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
  const menu = blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId));
  const iconBtn = cn("inline-flex size-11 items-center justify-center rounded-full text-foreground/80 transition-colors duration-200 hover:bg-muted hover:text-foreground", FOCUS);

  return (
    <header className={cn("z-40 bg-background", sticky && "sticky top-0", showSeparator && "border-b border-border")} {...sfProps}>
      <div className={cn(SHELL, "grid h-16 grid-cols-[1fr_auto] items-center gap-4 md:h-20 lg:h-[88px] lg:grid-cols-[1fr_auto_1fr]")}>
        <Link href="/" aria-label={store.name} title={store.name} className={cn("flex min-w-0 items-center gap-3 justify-self-start", FOCUS)}>
          {logoSrc ? (
            <Image src={logoSrc} alt={store.name} width={logoWidth} height={44} className="h-9 object-contain object-left lg:h-11" style={{ width: "auto", maxWidth: `${logoWidth}px` }} />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-[1.0625rem] leading-none tracking-[0.04em] text-primary-foreground ring-1 ring-inset ring-accent/60" style={{ fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" }}>
              <span aria-hidden>{initialsOf(store.name)}</span>
            </span>
          )}
        </Link>

        {blockOrder.length > 0 ? (
          <nav aria-label="Main" className={cn("hidden translate-y-[5px] items-center gap-8 lg:flex xl:gap-10", NAV_LINKS)}>
            {menu}
          </nav>
        ) : (
          <span className="hidden lg:block" />
        )}

        <div className="flex translate-y-[5px] items-center gap-1 justify-self-end md:gap-0">
          <Link href={searchHref} aria-label="Search the store" className={iconBtn}>
            <Search className="size-[19px]" strokeWidth={1.4} aria-hidden />
          </Link>
          <Link href={signedIn ? "/dashboard" : "/login"} prefetch={false} aria-label={signedIn ? "Dashboard" : "Store login"} className={cn(iconBtn, "hidden md:inline-flex")}>
            <User className="size-[19px]" strokeWidth={1.4} aria-hidden />
          </Link>
          {wishlist ? (
            <Link href="/wishlist" prefetch={false} aria-label={wishlist.ready && wishlist.count > 0 ? `Wishlist, ${wishlist.count} ${wishlist.count === 1 ? "item" : "items"}` : "Wishlist"} className={cn(iconBtn, "relative")}>
              <Heart className="size-[19px]" strokeWidth={1.4} aria-hidden />
              {wishlist.ready && wishlist.count > 0 ? (
                <span aria-hidden className="absolute right-1 top-1 flex size-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-medium leading-none text-primary-foreground">
                  {wishlist.count > 99 ? "99+" : wishlist.count}
                </span>
              ) : null}
            </Link>
          ) : null}
          {cart ? (
            <button type="button" onClick={cart.openDrawer} aria-label={cart.ready && cart.count > 0 ? `Bag, ${cart.count} ${cart.count === 1 ? "item" : "items"}` : "Bag"} className={cn(iconBtn, "relative")}>
              <ShoppingBag className="size-[19px]" strokeWidth={1.4} aria-hidden />
              {cart.ready && cart.count > 0 ? (
                <span aria-hidden className="absolute right-1 top-1 flex size-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-medium leading-none text-primary-foreground">
                  {cart.count > 99 ? "99+" : cart.count}
                </span>
              ) : null}
            </button>
          ) : null}
          {blockOrder.length > 0 ? (
            <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="storefront-menu" onClick={() => setOpen((v) => !v)} className={cn(iconBtn, "lg:hidden")}>
              {open ? <X className="size-5" strokeWidth={1.4} aria-hidden /> : <Menu className="size-5" strokeWidth={1.4} aria-hidden />}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <nav id="storefront-menu" aria-label="Main" className="border-t border-border bg-background lg:hidden" onClick={() => setOpen(false)}>
          <div className={cn(SHELL, "flex flex-col py-2 [&_a]:block [&_a]:border-b [&_a]:border-border [&_a]:py-4 [&_a]:text-[13px] [&_a]:font-medium [&_a]:uppercase [&_a]:tracking-[0.16em] [&_a]:text-foreground [&_a]:no-underline")}>
            {menu}
            <StoreAccessLink className="py-4 text-[13px] font-medium uppercase tracking-[0.16em] text-foreground/70" />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
