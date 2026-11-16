"use client";

import { StoreAccessLink } from "@/components/storefront/store-access-link";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Leaf, Menu, Search, ShoppingBag, Store, X } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";
import { CONTAINER, resolveImage } from "../ui";
import { cn } from "@/lib/utils";
import { isEditorialTheme, isGroceryTheme } from "@/lib/templates/engine/theme-style";

interface HeaderSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/** Store header: logo and name, the menu (a slide-down panel on phones), search and the store sign-in link. */
export function HeaderSection({ node, context, sectionId }: HeaderSectionProps) {
  const store = context.store;
  const logoWidth = (node.settings?.logoWidth as number) ?? 120;
  const menuAlignment = (node.settings?.menuAlignment as string) ?? "left";
  const sticky = Boolean(node.settings?.sticky ?? true);
  const showSeparator = Boolean(node.settings?.showSeparator ?? true);

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const [open, setOpen] = useState(false);

  // Close the panel on Escape, so keyboard users are never stuck in it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const custom = resolveImage(node.settings?.logoImage).url;
  const logoSrc = custom ?? resolveImage(store.logo_path).url;
  const searchHref = context.basePath ? `${context.basePath}/search` : "/search";
  const menu = blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId));

  // Atelier: a single-row editorial bar. Logo (or the store name as a serif wordmark) on the left, the menu in small spaced capitals
  // (aligned by the Menu Alignment setting), search, sign-in and a (non-functional) bag icon on the right. On phones the menu folds
  // into a button.
  if (isEditorialTheme(context.theme)) {
    const label = "text-[11px] font-medium uppercase tracking-[0.24em]";
    const focus = "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-foreground";
    const iconBtn = cn("inline-flex size-11 items-center justify-center text-foreground/75 transition-colors duration-300 hover:text-foreground", focus);
    return (
      <header className={cn(sticky ? "sticky top-0 z-40 bg-background/95 backdrop-blur-md" : "bg-background", showSeparator && "border-b border-foreground/10")} {...sfProps}>
        <div className={cn(CONTAINER, "flex items-center gap-6 lg:gap-12", "h-14 lg:h-16")}>
          <Link href="/" aria-label={store.name} className={cn("flex min-w-0 shrink-0 items-center", focus)}>
            {logoSrc ? (
              <Image src={logoSrc} alt={store.name} width={logoWidth} height={40} className={cn("object-contain object-left ", "h-7 lg:h-8")} style={{ width: "auto", maxWidth: `${logoWidth}px` }} />
            ) : (
              <span className="truncate text-xl font-light uppercase tracking-[0.3em] text-foreground sm:text-2xl" style={{ fontFamily: "var(--sf-font-heading, serif)" }}>
                {store.name}
              </span>
            )}
          </Link>

          {blockOrder.length > 0 ? (
            <nav aria-label="Main" className={cn("hidden items-center gap-10 md:flex [&_a]:relative [&_a]:py-1.5 [&_a]:text-[11px] [&_a]:font-medium [&_a]:uppercase [&_a]:tracking-[0.24em] [&_a]:text-foreground/70 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-300 [&_a:hover]:text-foreground [&_a:hover]:no-underline [&_a:focus-visible]:text-foreground [&_a:focus-visible]:outline [&_a:focus-visible]:outline-1 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-foreground [&_a]:after:absolute [&_a]:after:inset-x-0 [&_a]:after:bottom-0 [&_a]:after:h-px [&_a]:after:origin-left [&_a]:after:scale-x-0 [&_a]:after:bg-current [&_a]:after:transition-transform [&_a]:after:duration-300 [&_a:hover]:after:scale-x-100 motion-reduce:[&_a]:after:transition-none", menuAlignment === "center" ? "mx-auto" : menuAlignment === "right" ? "ml-auto" : "mr-auto")}>
              {menu}
            </nav>
          ) : (
            <span className="mr-auto" />
          )}

          <div className={cn("flex shrink-0 items-center gap-1 md:gap-6", blockOrder.length > 0 ? "ml-auto md:ml-0" : "ml-auto")}>
            <Link href={searchHref} aria-label="Search the store" className={iconBtn}>
              <Search className="size-[18px]" strokeWidth={1.25} aria-hidden />
            </Link>
            <StoreAccessLink className={cn("hidden text-foreground/70 transition-colors duration-300 hover:text-foreground md:inline", label, focus)} />
            {/* Placeholder: checkout is not built yet, so the bag does nothing. */}
            <button type="button" aria-label="Shopping bag" className={cn(iconBtn, "md:-mr-2")}>
              <ShoppingBag className="size-[18px]" strokeWidth={1.25} aria-hidden />
            </button>
            {blockOrder.length > 0 ? (
              <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="storefront-menu" onClick={() => setOpen((v) => !v)} className={cn(iconBtn, "-mr-3 md:hidden")}>
                {open ? <X className="size-5" strokeWidth={1.25} aria-hidden /> : <Menu className="size-5" strokeWidth={1.25} aria-hidden />}
              </button>
            ) : null}
          </div>
        </div>

        {open ? (
          <nav id="storefront-menu" aria-label="Main" className="border-t border-foreground/10 bg-background md:hidden" onClick={() => setOpen(false)}>
            <div className={cn(CONTAINER, "flex flex-col py-3 [&_a]:block [&_a]:border-b [&_a]:border-foreground/10 [&_a]:py-4 [&_a]:text-xs [&_a]:font-medium [&_a]:uppercase [&_a]:tracking-[0.24em] [&_a]:text-foreground [&_a]:no-underline")}>
              {menu}
              <StoreAccessLink className="py-4 text-xs font-medium uppercase tracking-[0.24em] text-foreground/70" />
            </div>
          </nav>
        ) : null}
      </header>
    );
  }

  // Freshly: a search-first header. The logo, a wide pill search field, sign-in and a filled bag button, with the menu as a
  // category rail underneath (the delivery promise lives in the store's announcement bar, not here). On phones the search field drops to its own row.
  if (isGroceryTheme(context.theme)) {
    const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
    const roundBtn = cn("inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors duration-200 hover:bg-primary/10 hover:text-primary", focus);
    const searchPill = cn("group flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-muted pl-4 pr-1.5 text-sm text-muted-foreground transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/50 hover:bg-background hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_12%,transparent)]", focus);
    return (
      <header className={cn(sticky ? "sticky top-0 z-40" : "relative", "bg-background", showSeparator && "border-b border-border")} {...sfProps}>
        <div className={cn(CONTAINER, "flex items-center gap-3 py-2.5 lg:gap-8 lg:py-3.5")}>
          <Link href="/" aria-label={store.name} className={cn("flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg", focus)}>
            {logoSrc ? (
              <Image src={logoSrc} alt={store.name} width={logoWidth} height={40} className="h-8 object-contain object-left lg:h-10" style={{ width: "auto", maxWidth: `${logoWidth}px` }} />
            ) : (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:size-10"><Leaf className="size-5" aria-hidden /></span>
                <span className="truncate text-lg font-extrabold tracking-tight text-foreground lg:text-xl" style={{ fontFamily: "var(--sf-font-heading, inherit)" }}>{store.name}</span>
              </>
            )}
          </Link>

          <Link href={searchHref} aria-label="Search the store" className={cn(searchPill, "hidden max-w-2xl md:mx-auto md:flex")}>
            <Search className="size-[18px] shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">Search fruit, vegetables, dairy and more</span>
            <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-[var(--primary-hover,var(--primary))]">Search</span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 lg:gap-2">
            <Link href={searchHref} aria-label="Search the store" className={cn(roundBtn, "md:hidden")}>
              <Search className="size-5" aria-hidden />
            </Link>
            <StoreAccessLink className={cn("hidden items-center rounded-full px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:inline-flex", focus)} />
            {/* Placeholder: checkout is not built yet, so the bag does nothing. */}
            <button type="button" aria-label="Shopping bag" className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-[var(--primary-hover,var(--primary))] md:px-5", focus)}>
              <ShoppingBag className="size-5" aria-hidden />
              <span className="hidden md:inline">Bag</span>
            </button>
            {blockOrder.length > 0 ? (
              <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="storefront-menu" onClick={() => setOpen((v) => !v)} className={cn(roundBtn, "md:hidden")}>
                {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
              </button>
            ) : null}
          </div>
        </div>

        <div className={cn(CONTAINER, "pb-2.5 md:hidden")}>
          <Link href={searchHref} aria-label="Search the store" className={searchPill}>
            <Search className="size-[18px] shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">Search groceries</span>
          </Link>
        </div>

        {blockOrder.length > 0 ? (
          <div className="hidden border-t border-border/70 md:block">
            <nav aria-label="Main" className={cn(CONTAINER, "flex items-center gap-1 py-1.5 [&_a]:relative [&_a]:rounded-full [&_a]:px-4 [&_a]:py-2 [&_a]:text-sm [&_a]:font-semibold [&_a]:text-foreground/80 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-200 [&_a:hover]:bg-primary/10 [&_a:hover]:text-primary [&_a:hover]:no-underline [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-primary", menuAlignment === "center" && "justify-center", menuAlignment === "right" && "justify-end")}>
              {menu}
            </nav>
          </div>
        ) : null}

        {open ? (
          <nav id="storefront-menu" aria-label="Main" className="border-t border-border bg-background md:hidden" onClick={() => setOpen(false)}>
            <div className={cn(CONTAINER, "flex flex-col gap-1 py-3 [&_a]:block [&_a]:rounded-xl [&_a]:px-4 [&_a]:py-3 [&_a]:text-base [&_a]:font-semibold [&_a]:text-foreground [&_a]:no-underline [&_a:hover]:bg-primary/10")}>
              {menu}
              <StoreAccessLink className="rounded-xl px-4 py-3 text-base font-semibold text-muted-foreground" />
            </div>
          </nav>
        ) : null}
      </header>
    );
  }

  return (
    <header className={cn(sticky ? "sticky top-0 z-40 bg-background/90 backdrop-blur-md" : "bg-background", showSeparator && "border-b border-border")} {...sfProps}>
      <div className={cn(CONTAINER, "flex h-16 items-center gap-4 lg:h-20 lg:gap-8")}>
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {logoSrc ? (
            <Image src={logoSrc} alt="" width={logoWidth} height={40} className="h-8 max-w-[9rem] rounded-sm object-contain sm:h-9 sm:max-w-none" style={{ width: "auto", maxWidth: `${logoWidth}px` }} />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius,0.375rem)] bg-primary text-primary-foreground">
              <Store className="size-4.5" aria-hidden />
            </span>
          )}
          <span className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{store.name}</span>
        </Link>

        {blockOrder.length > 0 ? (
          <nav aria-label="Main" className={cn("hidden items-center gap-7 md:flex [&_a]:text-sm [&_a]:text-foreground/75 [&_a:hover]:text-foreground", menuAlignment === "center" ? "mx-auto" : menuAlignment === "right" ? "ml-auto" : "mr-auto")}>
            {menu}
          </nav>
        ) : (
          <span className="mr-auto" />
        )}

        <div className={cn("ml-auto flex shrink-0 items-center gap-1 sm:gap-3", blockOrder.length > 0 && "md:ml-0")}>
          <Link href={searchHref} aria-label="Search the store" className="inline-flex size-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted hover:text-foreground">
            <Search className="size-5" aria-hidden />
          </Link>
          <StoreAccessLink className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline" />
          {blockOrder.length > 0 ? (
            <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="storefront-menu" onClick={() => setOpen((v) => !v)} className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted md:hidden">
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <nav id="storefront-menu" aria-label="Main" className="border-t border-border bg-background md:hidden" onClick={() => setOpen(false)}>
          <div className={cn(CONTAINER, "flex flex-col py-2 [&_a]:block [&_a]:border-b [&_a]:border-border/60 [&_a]:py-3.5 [&_a]:text-base [&_a]:text-foreground")}>
            {menu}
            <StoreAccessLink className="py-3.5 text-base text-muted-foreground" />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
