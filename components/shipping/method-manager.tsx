"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteMethodAction, saveMethodAction } from "@/app/(dashboard)/dashboard/shipping/actions";
import { ActionButton, ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { MethodApi, PricingType, ZoneApi } from "@/lib/api/endpoints/shipping-api";
import { currencyDigits, formatMoney } from "@/lib/money";

type Tier = { from: string; to: string; rate: string };
type Form = {
  zoneId: string; name: string; kind: "standard" | "express"; pricingType: PricingType;
  flatRate: string; freeOver: string; handling: string; minOrder: string; maxOrder: string; minWeight: string; maxWeight: string;
  daysMin: string; daysMax: string; codAllowed: boolean; carrierCode: string; sortOrder: string; enabled: boolean; tiers: Tier[];
};

const PRICING: Record<PricingType, string> = { flat: "Flat rate", free: "Free shipping", weight: "By parcel weight", order_value: "By order value", carrier: "Live carrier rate" };

const money = (minor: number | null | undefined, currency: string) => (minor === null || minor === undefined ? "" : (minor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency)));
const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

const blank = (zoneId: string): Form => ({ zoneId, name: "", kind: "standard", pricingType: "flat", flatRate: "", freeOver: "", handling: "", minOrder: "", maxOrder: "", minWeight: "", maxWeight: "", daysMin: "", daysMax: "", codAllowed: true, carrierCode: "", sortOrder: "0", enabled: true, tiers: [] });

const fromMethod = (m: MethodApi, currency: string): Form => ({
  zoneId: m.zoneId, name: m.name, kind: m.kind, pricingType: m.pricingType,
  flatRate: money(m.flatRateMinor, currency), freeOver: money(m.freeOverMinor, currency), handling: money(m.handlingMinor, currency),
  minOrder: m.minOrderMinor ? money(m.minOrderMinor, currency) : "", maxOrder: money(m.maxOrderMinor, currency),
  minWeight: m.minWeightGrams ? String(m.minWeightGrams) : "", maxWeight: num(m.maxWeightGrams),
  daysMin: num(m.estimatedDaysMin), daysMax: num(m.estimatedDaysMax), codAllowed: m.codAllowed, carrierCode: m.carrierCode ?? "", sortOrder: String(m.sortOrder), enabled: m.enabled,
  tiers: m.tiers.map((t) => ({ from: m.pricingType === "weight" ? String(t.from) : money(t.from, currency), to: t.to === null ? "" : m.pricingType === "weight" ? String(t.to) : money(t.to, currency), rate: money(t.rateMinor, currency) })),
});

const describe = (m: MethodApi, currency: string) => {
  switch (m.pricingType) {
    case "free": return "Always free";
    case "flat": return formatMoney(m.flatRateMinor, currency);
    case "weight": return `${m.tiers.length} weight band${m.tiers.length === 1 ? "" : "s"}`;
    case "order_value": return `${m.tiers.length} order-value band${m.tiers.length === 1 ? "" : "s"}`;
    case "carrier": return `Live ${m.carrierCode ?? "carrier"} rate${m.handlingMinor ? ` + ${formatMoney(m.handlingMinor, currency)} handling` : ""}`;
  }
};

/** Delivery methods and their rates, per zone. Rates are worked out by the API at checkout; nothing here prices an order. */
export function MethodManager({ methods, zones, currency, canManage }: { methods: MethodApi[]; zones: ZoneApi[]; currency: string; canManage: boolean }) {
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const f = editing?.form;
  const weight = f?.pricingType === "weight";
  const banded = weight || f?.pricingType === "order_value";
  const setTier = (i: number, patch: Partial<Tier>) => f && set({ tiers: f.tiers.map((t, n) => (n === i ? { ...t, ...patch } : t)) });

  return (
    <div className="space-y-4">
      {canManage ? (
        <div>
          <Button type="button" disabled={zones.length === 0} onClick={() => setEditing({ id: null, form: blank(zones[0]!.id) })}>
            <Plus aria-hidden /> Add method
          </Button>
          {zones.length === 0 ? <span className="ml-3 text-sm text-muted-foreground">Add a zone first.</span> : null}
        </div>
      ) : null}
      {zones.map((z) => {
        const list = methods.filter((m) => m.zoneId === z.id);
        return (
          <section key={z.id} className="rounded-lg border bg-card">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{z.name}</h2>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No delivery methods. Customers in this zone cannot check out until you add one.</p>
            ) : (
              <ul className="divide-y">
                {list.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {m.name} <span className="text-xs font-normal text-muted-foreground capitalize">{m.kind}</span> {!m.enabled ? <StatusBadge tone="draft" className="ml-1">Off</StatusBadge> : null}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {PRICING[m.pricingType]}: {describe(m, currency)}
                        {m.freeOverMinor !== null && m.pricingType !== "free" ? ` · free over ${formatMoney(m.freeOverMinor, currency)}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.estimatedDaysMin !== null ? `${m.estimatedDaysMin}-${m.estimatedDaysMax} days · ` : ""}COD {m.codAllowed ? "allowed" : "not allowed"}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ id: m.id, form: fromMethod(m, currency) })}>
                          <Pencil aria-hidden /> Edit
                        </Button>
                        <ActionButton variant="ghost" action={() => deleteMethodAction(m.id)} success="Method deleted" confirm={`Delete "${m.name}"?`}>
                          <Trash2 aria-hidden /> Delete
                        </ActionButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {editing && f ? (
        <ActionDialog key={editing.id ?? "new"} open onOpenChange={(o) => !o && setEditing(null)} title={editing.id ? "Edit delivery method" : "Add delivery method"} description="Rates are in your store currency. The server works out the charge for each cart at checkout." submitLabel="Save method" success="Method saved" wide onSubmit={() => saveMethodAction(editing.id, { ...f, currency })}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField id="mt-zone" label="Zone" required hint={editing.id ? "A method cannot move to another zone." : undefined}>
              <NativeSelect id="mt-zone" value={f.zoneId} disabled={Boolean(editing.id)} onChange={(e) => set({ zoneId: e.target.value })}>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="mt-name" label="Name shown at checkout" required>
              <Input id="mt-name" maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Standard delivery" />
            </FormField>
            <FormField id="mt-kind" label="Type">
              <NativeSelect id="mt-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as Form["kind"] })}>
                <option value="standard">Standard</option>
                <option value="express">Express</option>
              </NativeSelect>
            </FormField>
            <FormField id="mt-pricing" label="Pricing" required>
              <NativeSelect id="mt-pricing" value={f.pricingType} onChange={(e) => set({ pricingType: e.target.value as PricingType })}>
                {Object.entries(PRICING).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </NativeSelect>
            </FormField>
            {f.pricingType === "flat" ? (
              <FormField id="mt-flat" label={`Price (${currency})`} required>
                <Input id="mt-flat" inputMode="decimal" value={f.flatRate} onChange={(e) => set({ flatRate: e.target.value })} />
              </FormField>
            ) : null}
            {f.pricingType === "carrier" ? (
              <>
                <FormField id="mt-carrier" label="Carrier" optional hint="Leave on 'all' to compare every connected carrier.">
                  <NativeSelect id="mt-carrier" value={f.carrierCode} onChange={(e) => set({ carrierCode: e.target.value })}>
                    <option value="">All connected carriers</option>
                    <option value="shiprocket">Shiprocket</option>
                    <option value="delhivery">Delhivery</option>
                    <option value="bluedart">Blue Dart</option>
                  </NativeSelect>
                </FormField>
                <FormField id="mt-handling" label={`Handling added (${currency})`} optional hint="Packing or your margin.">
                  <Input id="mt-handling" inputMode="decimal" value={f.handling} onChange={(e) => set({ handling: e.target.value })} />
                </FormField>
              </>
            ) : null}
            {f.pricingType !== "free" ? (
              <FormField id="mt-freeover" label={`Free over (${currency})`} optional hint="Shipping is free once the items total reaches this.">
                <Input id="mt-freeover" inputMode="decimal" value={f.freeOver} onChange={(e) => set({ freeOver: e.target.value })} />
              </FormField>
            ) : null}
            <FormField id="mt-minorder" label={`Minimum order (${currency})`} optional>
              <Input id="mt-minorder" inputMode="decimal" value={f.minOrder} onChange={(e) => set({ minOrder: e.target.value })} />
            </FormField>
            <FormField id="mt-maxorder" label={`Maximum order (${currency})`} optional>
              <Input id="mt-maxorder" inputMode="decimal" value={f.maxOrder} onChange={(e) => set({ maxOrder: e.target.value })} />
            </FormField>
            <FormField id="mt-minw" label="Lightest parcel (grams)" optional>
              <Input id="mt-minw" inputMode="numeric" value={f.minWeight} onChange={(e) => set({ minWeight: e.target.value })} />
            </FormField>
            <FormField id="mt-maxw" label="Heaviest parcel (grams)" optional>
              <Input id="mt-maxw" inputMode="numeric" value={f.maxWeight} onChange={(e) => set({ maxWeight: e.target.value })} />
            </FormField>
            <FormField id="mt-dmin" label="Delivery time, shortest (days)" optional>
              <Input id="mt-dmin" inputMode="numeric" value={f.daysMin} onChange={(e) => set({ daysMin: e.target.value })} />
            </FormField>
            <FormField id="mt-dmax" label="Delivery time, longest (days)" optional>
              <Input id="mt-dmax" inputMode="numeric" value={f.daysMax} onChange={(e) => set({ daysMax: e.target.value })} />
            </FormField>
            <FormField id="mt-sort" label="Priority" hint="Lower numbers are listed first.">
              <Input id="mt-sort" inputMode="numeric" value={f.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
            </FormField>
          </div>
          {banded ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{weight ? "Weight bands (grams)" : `Order-value bands (${currency})`}</legend>
              <p className="text-xs text-muted-foreground">The first band starts at 0, bands join with no gap, and the last has no upper limit.</p>
              {f.tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <FormField id={`mt-tf-${i}`} label="From"><Input id={`mt-tf-${i}`} inputMode="decimal" value={t.from} onChange={(e) => setTier(i, { from: e.target.value })} /></FormField>
                  <FormField id={`mt-tt-${i}`} label="Up to (not incl.)"><Input id={`mt-tt-${i}`} inputMode="decimal" value={t.to} placeholder="and above" onChange={(e) => setTier(i, { to: e.target.value })} /></FormField>
                  <FormField id={`mt-tr-${i}`} label={`Charge (${currency})`}><Input id={`mt-tr-${i}`} inputMode="decimal" value={t.rate} onChange={(e) => setTier(i, { rate: e.target.value })} /></FormField>
                  <Button type="button" variant="ghost" size="icon-sm" className="mb-5" aria-label={`Remove band ${i + 1}`} onClick={() => set({ tiers: f.tiers.filter((_, n) => n !== i) })}><Trash2 aria-hidden /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set({ tiers: [...f.tiers, { from: f.tiers.length ? f.tiers[f.tiers.length - 1]!.to : "0", to: "", rate: "" }] })}>
                <Plus aria-hidden /> Add band
              </Button>
            </fieldset>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Offer at checkout</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.codAllowed} onChange={(e) => set({ codAllowed: e.target.checked })} /> Allow cash on delivery</label>
          </div>
        </ActionDialog>
      ) : null}
    </div>
  );
}
