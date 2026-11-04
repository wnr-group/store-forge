"use client";

import { useState } from "react";
import { Plus, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { MAX_VARIANTS } from "@/lib/validations/catalog";

export type OptionDraft = { name: string; values: string[] };
export type VariantDraft = {
  id?: string;
  options: Record<string, string>;
  sku: string;
  price: string;
  compareAtPrice: string;
  quantity: number | string;
  imagePath: string | null;
  isActive: boolean;
};

type Props = {
  options: OptionDraft[];
  variants: VariantDraft[];
  basePrice: string;
  imagePaths: string[];
  trackInventory: boolean;
  disabled?: boolean;
  errors?: Record<string, string>;
  onOptionsChange: (o: OptionDraft[]) => void;
  onVariantsChange: (v: VariantDraft[]) => void;
};

const signature = (o: Record<string, string>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

/** Cartesian product of option values, e.g. Size x Color. */
export function combinations(options: OptionDraft[]): Record<string, string>[] {
  const valid = options.filter((o) => o.name.trim() && o.values.length);
  return valid.reduce<Record<string, string>[]>((acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name.trim()]: v }))), [{}]).filter((c) => Object.keys(c).length);
}

export function VariantsEditor({ options, variants, basePrice, imagePaths, trackInventory, disabled, errors = {}, onOptionsChange, onVariantsChange }: Props) {
  const [draft, setDraft] = useState<Record<number, string>>({});

  const setOption = (i: number, patch: Partial<OptionDraft>) => onOptionsChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const addValues = (i: number, raw: string) => {
    const incoming = raw.split(",").map((v) => v.trim()).filter(Boolean);
    if (!incoming.length) return;
    const existing = new Set(options[i].values.map((v) => v.toLowerCase()));
    const fresh = incoming.filter((v) => !existing.has(v.toLowerCase()));
    setOption(i, { values: [...options[i].values, ...fresh].slice(0, 20) });
    setDraft((d) => ({ ...d, [i]: "" }));
  };

  /** Keeps data of combinations that still exist; adds new ones; drops combinations that no longer exist. */
  const generate = () => {
    const wanted = combinations(options);
    const byKey = new Map(variants.map((v) => [signature(v.options), v]));
    onVariantsChange(
      wanted.slice(0, MAX_VARIANTS).map(
        (options) => byKey.get(signature(options)) ?? { options, sku: "", price: basePrice, compareAtPrice: "", quantity: 0, imagePath: null, isActive: true },
      ),
    );
  };

  const setVariant = (i: number, patch: Partial<VariantDraft>) => onVariantsChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const total = combinations(options).length;
  const stale = variants.length !== total || combinations(options).some((c) => !variants.some((v) => signature(v.options) === signature(c)));

  return (
    <div className="space-y-5">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sell this product in more than one size, colour or style. Each combination gets its own SKU, price and stock.</p>
      ) : null}

      {options.map((opt, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <Input value={opt.name} onChange={(e) => setOption(i, { name: e.target.value })} placeholder="Option name, e.g. Size" aria-label={`Option ${i + 1} name`} disabled={disabled} className="max-w-56" />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onOptionsChange(options.filter((_, idx) => idx !== i))} disabled={disabled} aria-label={`Remove option ${opt.name || i + 1}`}>
              <X aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {opt.values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
                {v}
                <button type="button" disabled={disabled} onClick={() => setOption(i, { values: opt.values.filter((x) => x !== v) })} aria-label={`Remove ${v}`} className="rounded-full text-muted-foreground hover:text-foreground">
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
            <Input
              value={draft[i] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [i]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addValues(i, draft[i] ?? "");
                }
              }}
              onBlur={() => addValues(i, draft[i] ?? "")}
              placeholder="Type a value, press Enter"
              aria-label={`Values for ${opt.name || `option ${i + 1}`}`}
              disabled={disabled}
              className="h-7 w-44"
            />
          </div>
        </div>
      ))}
      {errors.options ? <p role="alert" className="text-xs text-destructive">{errors.options}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {options.length < 3 ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onOptionsChange([...options, { name: "", values: [] }])}>
            <Plus aria-hidden /> Add option
          </Button>
        ) : null}
        {options.length > 0 ? (
          <Button type="button" size="sm" variant={stale ? "default" : "outline"} disabled={disabled || total === 0 || total > MAX_VARIANTS} onClick={generate}>
            <Wand2 aria-hidden /> {variants.length ? "Update variants" : "Generate variants"} ({total})
          </Button>
        ) : null}
        {total > MAX_VARIANTS ? <span className="text-xs text-destructive">Too many combinations (max {MAX_VARIANTS}).</span> : null}
      </div>
      {options.length > 0 && stale && variants.length > 0 ? <p className="text-xs text-muted-foreground">Options changed. Update variants to apply (existing prices and stock are kept for combinations that remain).</p> : null}
      {errors.variants ? <p role="alert" className="text-xs text-destructive">{errors.variants}</p> : null}

      {variants.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Variant</th>
                <th className="px-2 py-2 font-medium">SKU</th>
                <th className="px-2 py-2 font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Compare-at</th>
                <th className="px-2 py-2 font-medium">Stock</th>
                <th className="px-2 py-2 font-medium">Image</th>
                <th className="px-2 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((v, i) => (
                <tr key={signature(v.options)} className={v.isActive ? undefined : "opacity-60"}>
                  <td className="px-3 py-2 font-medium">{Object.values(v.options).join(" / ")}</td>
                  <td className="px-2 py-1.5">
                    <Input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} aria-label={`SKU for ${Object.values(v.options).join(" ")}`} aria-invalid={Boolean(errors[`variants.${i}.sku`])} disabled={disabled} className="h-7 w-28" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} inputMode="decimal" aria-label={`Price for ${Object.values(v.options).join(" ")}`} aria-invalid={Boolean(errors[`variants.${i}.price`])} disabled={disabled} className="h-7 w-24" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={v.compareAtPrice} onChange={(e) => setVariant(i, { compareAtPrice: e.target.value })} inputMode="decimal" aria-label={`Compare-at price for ${Object.values(v.options).join(" ")}`} disabled={disabled} className="h-7 w-24" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={String(v.quantity)} onChange={(e) => setVariant(i, { quantity: e.target.value })} inputMode="numeric" aria-label={`Stock for ${Object.values(v.options).join(" ")}`} aria-invalid={Boolean(errors[`variants.${i}.quantity`])} disabled={disabled || !trackInventory} className="h-7 w-20" />
                  </td>
                  <td className="px-2 py-1.5">
                    <NativeSelect aria-label={`Image for ${Object.values(v.options).join(" ")}`} value={v.imagePath ?? ""} onChange={(e) => setVariant(i, { imagePath: e.target.value || null })} disabled={disabled || imagePaths.length === 0} className="h-7 w-28">
                      <option value="">None</option>
                      {imagePaths.map((p, n) => (
                        <option key={p} value={p}>{`Image ${n + 1}`}</option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="px-2 py-1.5">
                    <Switch checked={v.isActive} onCheckedChange={(c) => setVariant(i, { isActive: c })} disabled={disabled} aria-label={`${Object.values(v.options).join(" ")} active`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!trackInventory && variants.length > 0 ? <p className="text-xs text-muted-foreground">Inventory tracking is off, so variant stock is not used.</p> : null}
    </div>
  );
}
