"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type PickOption = { id: string; name: string; note?: string };

/**
 * Choose any number of items from a list (products, collections or discount codes): a filter box and a checklist. Selected items stay
 * ticked while the filter changes, and the count is announced. Nothing here knows what the items are; the server checks every id.
 */
export function TargetPicker({ id, label, options, value, onChange, error, disabled, emptyText }: { id: string; label: string; options: PickOption[]; value: string[]; onChange: (ids: string[]) => void; error?: string; disabled?: boolean; emptyText: string }) {
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? options.filter((o) => o.name.toLowerCase().includes(f)) : options;
  }, [options, filter]);
  const selected = new Set(value);
  const toggle = (optionId: string, on: boolean) => onChange(on ? [...value, optionId] : value.filter((v) => v !== optionId));

  return (
    <fieldset className="space-y-2" aria-describedby={`${id}-msg`}>
      <legend className="text-sm font-medium">{label}</legend>
      {options.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          {options.length > 8 ? <Input aria-label={`Filter ${label.toLowerCase()}`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" disabled={disabled} /> : null}
          <ul className="max-h-48 divide-y overflow-y-auto rounded-md border" role="group">
            {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Nothing matches.</li> : null}
            {shown.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                  <Checkbox checked={selected.has(o.id)} onCheckedChange={(on) => toggle(o.id, on === true)} disabled={disabled} />
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.note ? <span className="shrink-0 text-xs text-muted-foreground">{o.note}</span> : null}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <p id={`${id}-msg`} role={error ? "alert" : "status"} className={error ? "text-xs text-error" : "text-xs text-muted-foreground"}>
        {error ?? `${value.length} selected`}
      </p>
    </fieldset>
  );
}
