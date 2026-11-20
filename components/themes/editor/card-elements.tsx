"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CARD_PARTS, COLLECTION_CARD_PARTS, availableCardParts, countOnByDefault, readCardParts, readCollectionCardParts, type CardKind } from "@/lib/templates/card-parts";
import { cn } from "@/lib/utils";

/** What the editor needs to know about the theme to offer the right card elements. */
export type CardContext = {
  look: string | undefined;
  /** Whether the cards of this theme show the short description when the merchant has not chosen. */
  descriptionDefault: boolean;
};

type Part = { key: string; setting: string; label: string; help: string };

/**
 * The elements of a product card, like the blocks of a product card in Shopify: each element that is shown is listed and can be
 * taken away (x); the + button lists the elements that are not shown and adds the one picked. The choice is stored as one toggle
 * per element in the settings of the section (see lib/templates/card-parts.ts), so the preview changes at once.
 */
export function CardElements({ kind = "product", settings, context, disabled, onChange, className }: { kind?: CardKind; settings: Record<string, unknown> | undefined; context: CardContext; disabled: boolean; onChange: (setting: string, value: boolean) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  // The elements this kind of card has, which of them are on, and the words for each.
  const all: readonly Part[] = kind === "collection" ? COLLECTION_CARD_PARTS : CARD_PARTS;
  const available: string[] = kind === "collection" ? COLLECTION_CARD_PARTS.map((p) => p.key) : availableCardParts(context.look);
  const on: Record<string, boolean> = kind === "collection" ? readCollectionCardParts(settings, countOnByDefault(context.look)) : readCardParts(settings, context.descriptionDefault);
  const LABEL = Object.fromEntries(all.map((p) => [p.key, p])) as Record<string, Part>;
  const shown = available.filter((k) => on[k]);
  const hidden = available.filter((k) => !on[k]);

  return (
    <div className={cn("rounded-lg border bg-background/60", className)} role="group" aria-label={`${kind === "collection" ? "Collection" : "Product"} card elements`}>
      <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-3">
        <span className="text-xs font-semibold">{kind === "collection" ? "Collection card" : "Product card"}</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled || hidden.length === 0}
            aria-label={`Add a ${kind} card element`}
            title={hidden.length === 0 ? "Every element is shown" : `Add an element to the ${kind} card`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-primary hover:bg-primary/10 hover:text-primary")}
          >
            <Plus aria-hidden />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 gap-0 p-1.5">
            <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Add to {kind} card</p>
            {hidden.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  onChange(LABEL[k].setting, true);
                  // Closes after the last one; stays open while others can still be added.
                  if (hidden.length === 1) setOpen(false);
                }}
                className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <Plus className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{LABEL[k].label}</span>
                  <span className="block text-xs text-muted-foreground">{LABEL[k].help}</span>
                </span>
              </button>
            ))}
            {hidden.length === 0 ? (
              <p className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground"><Check className="size-3.5" aria-hidden /> Every element is already shown.</p>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
      {shown.length > 0 ? (
        <ul className="border-t p-1">
          {shown.map((k) => (
            <li key={k} className="group/part flex items-center justify-between gap-2 rounded-md py-0.5 pr-0.5 pl-2.5 text-[13px] hover:bg-muted">
              <span className="truncate">{LABEL[k].label}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(LABEL[k].setting, false)}
                aria-label={`Remove ${LABEL[k].label} from the ${kind} card`}
                title="Remove"
                className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:opacity-0 lg:group-focus-within/part:opacity-100 lg:group-hover/part:opacity-100"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">The card is empty. Use + to add an element.</p>
      )}
    </div>
  );
}
