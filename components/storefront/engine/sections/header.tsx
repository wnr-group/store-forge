"use client";

import { StoreAccessLink } from "@/components/storefront/store-access-link";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, Store, X } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { renderBlockComponent } from "../blocks";
import { CONTAINER, resolveImage } from "../ui";
import { cn } from "@/lib/utils";

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
