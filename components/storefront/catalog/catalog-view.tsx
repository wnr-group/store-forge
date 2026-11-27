"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { CATALOG_SKINS, type CatalogSkin } from "@/components/storefront/catalog/skins";
import { LOOKS } from "@/components/storefront/engine/looks";
import { GRID_GAP, ImagePlaceholder, ProductCard } from "@/components/storefront/engine/ui";
import type { PublicCatalogNode } from "@/lib/catalog/public-types";
import { PUBLIC_CATALOG_SORTS, type PublicCatalogSort } from "@/lib/catalog/public-types";
import { catalogHref, catalogImage, catalogQueryHref, pageWindow, SORT_LABELS, toCardProduct, totalPagesOf, type CatalogRenderData } from "@/lib/storefront/catalog";
import { lookOf } from "@/lib/templates/engine/theme-style";
import { cn } from "@/lib/utils";

/**
 * The catalog hierarchy page, the same for every template: breadcrumbs, the items one step down, and the products placed on the item
 * (with sorting and pages). What differs per template is only the skin (wrapper, headings, tiles) and the product card, which is the
 * template's own card (`StorefrontLook.card`), so a part looks like every other product of that store. Nothing is fetched here.
 */
export function CatalogView({ data, theme, currency, storeName, sfProps }: { data: CatalogRenderData; theme: unknown; currency: string; storeName: string; sfProps?: Record<string, string> }) {
  const look = lookOf(theme);
  const skin = CATALOG_SKINS[look];
  const LookCard = LOOKS[look]?.card ?? null;
  const base = catalogHref(data.node?.path);
  const { node, products } = data;

  const crumbs = [
    { label: "Home", href: "/" },
    { label: data.hierarchyName ?? "Catalog", href: node ? CATALOG_ROOT : undefined },
    ...data.breadcrumbs.map((b, i, all) => ({ label: b.name, href: i < all.length - 1 ? catalogHref(b.path) : undefined })),
  ];

  const titleText = node ? node.name : (data.hierarchyName ?? "Catalog");
  const eyebrow = node ? node.level.name : (data.levels[0]?.name ?? "");
  const headerImage = node ? catalogImage(node) : null;
  // When any tile of a list has a picture, every tile gets a picture area (a soft placeholder where there is none), so the tiles stay level.
  const withPictures = data.children.some((c) => catalogImage(c) !== null);

  return (
    <section className={skin.shell} aria-labelledby="catalog-title" {...sfProps}>
      <Crumbs skin={skin} items={crumbs} />
      <header className={cn("mt-4", headerImage && "flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6")}>
        {headerImage ? (
          // A fixed square box, so the text does not move when the picture arrives. The picture is above the fold: load it first.
          <div className={cn("relative size-28 shrink-0 overflow-hidden sm:size-36", skin.headerMedia)}>
            <Image src={headerImage.src} alt={headerImage.alt} fill priority sizes="(min-width: 640px) 144px, 112px" className="object-cover" />
          </div>
        ) : null}
        <div className="min-w-0 space-y-3">
          {eyebrow ? <skin.Eyebrow>{eyebrow}</skin.Eyebrow> : null}
          <div id="catalog-title">
            <skin.Title>{titleText}</skin.Title>
          </div>
          {node?.description ? <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{node.description}</p> : null}
        </div>
      </header>

      {data.children.length > 0 ? (
        <div className="mt-8 sm:mt-10">
          <h2 className={cn(skin.groupTitle, "mb-4")}>{node ? `Browse by ${data.childLevelName ?? "option"}` : `Shop by ${data.childLevelName ?? "category"}`}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4" aria-label={data.childLevelName ?? "Items"}>
            {data.children.map((child) => (
              <li key={child.id} className="min-w-0">
                <NodeTile child={child} skin={skin} withPicture={withPictures} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {products ? (
        <ProductsArea
          data={data}
          skin={skin}
          currency={currency}
          base={base}
          LookCard={LookCard}
          canIncludeAll={Boolean(node?.hasChildren)}
        />
      ) : null}

      {data.view === "root" && data.children.length === 0 ? <Empty text={`${storeName} has not added anything to this catalog yet. Please check back soon.`} /> : null}
      {data.view === "node" && data.children.length === 0 && (products?.total ?? 0) === 0 ? <Empty text="There is nothing here yet. Try another choice, or go back up a step." backHref={node?.parentId ? undefined : CATALOG_ROOT} /> : null}
    </section>
  );
}

const CATALOG_ROOT = catalogHref();

function Crumbs({ skin, items }: { skin: CatalogSkin; items: { label: string; href?: string }[] }) {
  if (skin.Crumbs) return <skin.Crumbs items={items} />;
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden /> : null}
            {it.href ? (
              <Link href={it.href} className="hover:text-foreground hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-foreground">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NodeTile({ child, skin, withPicture }: { child: PublicCatalogNode; skin: CatalogSkin; withPicture: boolean }) {
  const image = catalogImage(child);
  const meta = child.productCount > 0 ? `${child.productCount} ${child.productCount === 1 ? "part" : "parts"}` : child.hasChildren ? "Browse" : "";
  return (
    <Link href={catalogHref(child.path)} className={cn(skin.tile, withPicture && "overflow-hidden")} data-sf-card="">
      {withPicture ? (
        <span className={cn("relative block", skin.media)} data-catalog-media="">
          {image ? (
            <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
          ) : (
            <ImagePlaceholder className="absolute inset-0" icon={false} />
          )}
        </span>
      ) : null}
      <span className="min-w-0 space-y-1">
        <span className="block text-base leading-snug font-medium break-words text-foreground">{child.name}</span>
        {child.description ? <span className="line-clamp-2 block text-sm text-muted-foreground">{child.description}</span> : null}
      </span>
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{meta}</span>
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
      </span>
    </Link>
  );
}

function ProductsArea({ data, skin, currency, base, LookCard, canIncludeAll }: { data: CatalogRenderData; skin: CatalogSkin; currency: string; base: string; LookCard: (typeof LOOKS)[keyof typeof LOOKS]["card"] | null; canIncludeAll: boolean }) {
  const router = useRouter();
  const products = data.products!;
  const { query } = data;
  if (products.total === 0 && !query.all) {
    // Nothing placed directly here: offer the products of the items below when there are some, otherwise say nothing (the empty state does).
    return canIncludeAll ? (
      <p className="mt-8 text-sm text-muted-foreground">
        No parts are placed directly here.{" "}
        <Link href={catalogQueryHref(base, { ...query, all: true, page: 1 })} className="underline underline-offset-2 hover:text-foreground">
          Show all parts in this group
        </Link>
      </p>
    ) : null;
  }
  const totalPages = totalPagesOf(products);
  const list = products.items.map(toCardProduct);

  return (
    <div className="mt-10 sm:mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className={skin.groupTitle}>
          Parts <span className="ml-1 text-sm font-normal text-muted-foreground" role="status">({products.total.toLocaleString("en-US")})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {canIncludeAll ? (
            <Link href={catalogQueryHref(base, { ...query, all: !query.all, page: 1 })} className={skin.control} aria-pressed={query.all}>
              {query.all ? "Only this group" : "Include sub-groups"}
            </Link>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Sort by</span>
            <select
              value={query.sort}
              onChange={(e) => router.push(catalogQueryHref(base, { ...query, sort: e.target.value as PublicCatalogSort, page: 1 }))}
              className={cn(skin.control, "pr-7")}
              aria-label="Sort parts"
            >
              {PUBLIC_CATALOG_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty text="No parts on this page. Go back to the first page." backHref={catalogQueryHref(base, { ...query, page: 1 })} />
      ) : (
        <ul className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", GRID_GAP)} aria-label="Parts">
          {list.map((p, i) => (
            <li key={p.slug} className="min-w-0">
              {LookCard ? <LookCard product={p} currency={currency} href={`/products/${p.slug}`} priority={i < 4} /> : <ProductCard product={p} currency={currency} href={`/products/${p.slug}`} priority={i < 4} showDescription />}
              {p.part_number ? (
                <p className="mt-1.5 px-0.5 text-xs text-muted-foreground">
                  Part no. <span className="font-mono text-foreground">{p.part_number}</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? <Pagination page={products.page} totalPages={totalPages} base={base} query={query} skin={skin} /> : null}
    </div>
  );
}

function Pagination({ page, totalPages, base, query, skin }: { page: number; totalPages: number; base: string; query: CatalogRenderData["query"]; skin: CatalogSkin }) {
  const link = (n: number) => catalogQueryHref(base, { ...query, page: n });
  return (
    <nav aria-label="Pages" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={link(page - 1)} rel="prev" className={cn(skin.control, "inline-flex items-center gap-1")}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : null}
      {pageWindow(page, totalPages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link key={n} href={link(n)} aria-current={n === page ? "page" : undefined} aria-label={`Page ${n}`} className={cn(skin.control, "min-w-9 text-center tabular-nums", n === page && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}>
            {n}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={link(page + 1)} rel="next" className={cn(skin.control, "inline-flex items-center gap-1")}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

function Empty({ text, backHref }: { text: string; backHref?: string }) {
  return (
    <div role="status" className="mt-10 rounded-[var(--radius,0.5rem)] border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
      <p>{text}</p>
      {backHref ? (
        <p className="mt-3">
          <Link href={backHref} className="underline underline-offset-2 hover:text-foreground">
            Go back
          </Link>
        </p>
      ) : null}
    </div>
  );
}
