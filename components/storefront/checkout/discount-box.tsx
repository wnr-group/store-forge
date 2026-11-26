"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { INPUT, MUTED, SECONDARY_BUTTON } from "./checkout-ui";

/**
 * The discount code field of the order summary. It only collects a code and shows the answer: whether the code works and what it is
 * worth is decided by the store's server (here as a preview, and again when the order is priced and placed), never in the browser.
 */
export function DiscountBox({
  applied,
  error,
  checking,
  onApply,
  onRemove,
  money,
}: {
  /** The code in use and what it takes off, once the server has accepted it. */
  applied: { code: string; discountMinor: number } | null;
  error: string | null;
  checking: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
  money: (minor: number) => string;
}) {
  const [code, setCode] = useState("");

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 border border-border px-4 py-3 text-[13px]">
        <span>
          <span className="font-medium tracking-wide">{applied.code}</span>
          <span className={cn("block text-[12px]", MUTED)}>Takes {money(applied.discountMinor)} off</span>
        </span>
        <button type="button" onClick={onRemove} className="text-[12px] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Remove
        </button>
      </div>
    );
  }

  const submit = () => {
    const value = code.trim();
    if (value && !checking) onApply(value);
  };
  return (
    <div className="grid gap-1.5">
      <label htmlFor="co-discount" className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", MUTED)}>
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="co-discount"
          className={cn(INPUT, "h-11 flex-1 uppercase")}
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          placeholder="Enter code"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            // Enter applies the code; it must not place the order.
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "co-discount-error" : undefined}
        />
        <button type="button" onClick={submit} disabled={checking || !code.trim()} className={cn(SECONDARY_BUTTON, "h-11 w-auto px-5")}>
          {checking ? "Checking…" : "Apply"}
        </button>
      </div>
      {error ? (
        <p id="co-discount-error" role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
