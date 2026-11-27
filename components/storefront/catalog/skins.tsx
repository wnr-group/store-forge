import type { ComponentType } from "react";
import { DisplayHeading, Eyebrow } from "@/components/storefront/engine/looks/boutique/eyebrow";
import { SHELL as BOUTIQUE_SHELL } from "@/components/storefront/engine/looks/boutique/shell";
import { Breadcrumbs as MarketCrumbs, PANEL as MARKET_PANEL, WRAP as MARKET_WRAP } from "@/components/storefront/engine/looks/market/ui";
import { SHELL as SPORT_SHELL, SportEyebrow, SportTitle } from "@/components/storefront/engine/looks/sport/ui";
import { CONTAINER } from "@/components/storefront/engine/ui";
import type { LookId } from "@/lib/templates/looks";
import { cn } from "@/lib/utils";

/**
 * How one template draws the catalog hierarchy page. The page's data and behaviour are the same for every template (see
 * `CatalogView`); a skin only supplies the template's own wrapper, heading, breadcrumb and tile styling, and reuses the template's own
 * building blocks. `Record<LookId, ...>` makes the compiler fail when a new look is added without a skin, so no template can be left out.
 */
export type CatalogSkin = {
  /** The page wrapper classes: the template's page width and gutters. */
  shell: string;
  Eyebrow: ComponentType<{ children: string }>;
  Title: ComponentType<{ children: string }>;
  /** The breadcrumb trail. Null uses the shared one. */
  Crumbs: ComponentType<{ items: { label: string; href?: string }[] }> | null;
  /** Classes of one item tile (a link to a child item). */
  tile: string;
  /** Classes of the small heading above a group (the children, the products). */
  groupTitle: string;
  /** Classes of the primary text on the page, for the toolbar and pagination buttons. */
  control: string;
};

const PLAIN_CONTROL = "rounded-[var(--radius,0.5rem)] border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const PlainEyebrow = ({ children }: { children: string }) => <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">{children}</p>;
const PlainTitle = ({ children }: { children: string }) => <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-4xl">{children}</h1>;

/** The engine's own look (every theme without a look of its own): theme colours, radius and fonts. */
const standard: CatalogSkin = {
  shell: cn(CONTAINER, "py-10 sm:py-14"),
  Eyebrow: PlainEyebrow,
  Title: PlainTitle,
  Crumbs: null,
  tile: "group flex h-full flex-col justify-between gap-3 rounded-[var(--radius,0.5rem)] border border-border bg-card p-5 text-card-foreground transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  groupTitle: "text-lg font-semibold tracking-tight text-foreground",
  control: PLAIN_CONTROL,
};

/** Boutique (Maison): ivory page, display serif headings, rounded soft tiles. */
const boutique: CatalogSkin = {
  shell: cn(BOUTIQUE_SHELL, "py-10 md:py-14"),
  Eyebrow: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  Title: ({ children }) => <DisplayHeading as="h1">{children}</DisplayHeading>,
  Crumbs: null,
  tile: "group flex h-full flex-col justify-between gap-3 rounded-[1.375rem] border border-border bg-muted/40 p-5 transition-colors hover:border-foreground/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
  groupTitle: "text-xl leading-tight tracking-[-0.01em] text-foreground [font-family:var(--sf-font-heading)]",
  control: "rounded-full border border-border bg-background px-4 py-1.5 text-sm text-foreground transition-colors hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
};

/** Sport (Stride): heavy italic capitals with the accent bar, pill controls. */
const sport: CatalogSkin = {
  shell: cn(SPORT_SHELL, "py-10 md:py-14"),
  Eyebrow: ({ children }) => <SportEyebrow>{children}</SportEyebrow>,
  Title: ({ children }) => <SportTitle as="h1">{children}</SportTitle>,
  Crumbs: null,
  tile: "group flex h-full flex-col justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-5 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  groupTitle: "text-xl font-extrabold tracking-tight text-primary uppercase",
  control: "rounded-full border border-border bg-background px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
};

/** Market (Marketplace): dense panels, its own breadcrumb and compact heading. */
const market: CatalogSkin = {
  shell: cn(MARKET_WRAP, "py-4"),
  Eyebrow: ({ children }) => <p className="text-[12px] font-semibold text-secondary">{children}</p>,
  Title: ({ children }) => <h1 className="mt-1 text-xl leading-tight font-bold text-primary sm:text-[22px]">{children}</h1>,
  Crumbs: MarketCrumbs,
  tile: cn(MARKET_PANEL, "group flex h-full flex-col justify-between gap-3 p-4 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"),
  groupTitle: "text-base font-bold text-primary",
  control: "rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
};

export const CATALOG_SKINS: Record<LookId, CatalogSkin> = { standard, boutique, sport, market };
