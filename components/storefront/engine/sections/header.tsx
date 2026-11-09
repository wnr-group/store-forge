import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Store } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";

interface HeaderSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function HeaderSection({ node, context, sectionId }: HeaderSectionProps) {
  const store = context.store;
  const logoImageVal = node.settings?.logoImage as { path?: string; alt?: string } | string | null | undefined;
  const rawCustomLogo = typeof logoImageVal === "string" ? logoImageVal : logoImageVal?.path;
  const logoWidth = (node.settings?.logoWidth as number) ?? 120;
  const menuAlignment = (node.settings?.menuAlignment as string) ?? "left";
  const sticky = Boolean(node.settings?.sticky ?? true);
  const showSeparator = Boolean(node.settings?.showSeparator ?? true);

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const logoSrc = rawCustomLogo
    ? rawCustomLogo.startsWith("http://") || rawCustomLogo.startsWith("https://") || rawCustomLogo.startsWith("/")
      ? rawCustomLogo
      : publicImageUrl(rawCustomLogo)
    : publicImageUrl(store.logo_path);

  const stickyClass = sticky ? "sticky top-0 z-40 bg-background/95 backdrop-blur-xs" : "bg-background";
  const borderClass = showSeparator ? "border-b border-border" : "";

  return (
    <header className={`${stickyClass} ${borderClass}`} {...sfProps}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3">
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={store.name || "Store Logo"}
              width={logoWidth}
              height={36}
              className="h-9 rounded-md object-contain"
              style={{ width: `${logoWidth}px` }}
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Store className="size-5" aria-hidden />
            </span>
          )}
          <span className="truncate text-lg font-semibold tracking-tight text-foreground">{store.name}</span>
        </Link>

        {/* Navigation Blocks */}
        {blockOrder.length > 0 ? (
          <nav
            className={`hidden items-center gap-6 md:flex ${
              menuAlignment === "center" ? "mx-auto" : menuAlignment === "right" ? "ml-auto" : "mr-auto"
            }`}
          >
            {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
          </nav>
        ) : null}

        {/* Store Login */}
        <Link
          href="/login"
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
        >
          Store login
        </Link>
      </div>
    </header>
  );
}
