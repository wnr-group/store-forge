"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TEMPLATES, type TemplateKey } from "@/lib/templates/registry";

type Props = { selected: TemplateKey; current: TemplateKey; onSelect: (key: TemplateKey) => void };

/** Current = the saved template used by the public storefront. Selected = the one being previewed (may be unsaved). */
export function TemplatePicker({ selected, current, onSelect }: Props) {
  return (
    <div role="group" aria-label="Templates" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      {TEMPLATES.map((t) => {
        const isSelected = t.key === selected;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(t.key)}
            data-template-card={t.key}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isSelected ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30",
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.name}</span>
              {t.key === current ? <Badge variant="secondary">Current</Badge> : null}
              {isSelected ? <Badge>Selected</Badge> : null}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{t.description}</span>
          </button>
        );
      })}
    </div>
  );
}
