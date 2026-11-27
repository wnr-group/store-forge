"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_LINE_QUANTITY } from "@/lib/cart/cart";
import { cn } from "@/lib/utils";

/** The small square quantity control of the bag: a hairline box with minus, the number and plus. */
export function QtyStepper({ value, onChange, label, className }: { value: number; onChange: (next: number) => void; label: string; className?: string }) {
  const btn = "flex h-full w-7 items-center justify-center text-[color:var(--sf-color-muted)] transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[color:var(--sf-color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
  return (
    <div role="group" aria-label={`Quantity of ${label}`} className={cn("inline-flex h-8 w-20 items-stretch rounded-[var(--pg-radius,0px)] border border-border bg-transparent text-[15px] text-foreground", className)}>
      <button type="button" aria-label={`Decrease quantity of ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)} className={btn}>
        <Minus className="size-3" strokeWidth={1.5} aria-hidden />
      </button>
      <span className="flex flex-1 items-center justify-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`Increase quantity of ${label}`} disabled={value >= MAX_LINE_QUANTITY} onClick={() => onChange(value + 1)} className={btn}>
        <Plus className="size-3" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
