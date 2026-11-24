"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteZoneAction, saveZoneAction } from "@/app/(dashboard)/dashboard/shipping/actions";
import { ActionButton, ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATE_NAMES } from "@/lib/checkout/states";
import type { ZoneApi, ZoneDetailApi } from "@/lib/api/endpoints/shipping-api";

type Form = { name: string; enabled: boolean; codAllowed: boolean; country: boolean; states: string[]; cities: string; postalCodes: string; postalRanges: string };

const blank: Form = { name: "", enabled: true, codAllowed: true, country: false, states: [], cities: "", postalCodes: "", postalRanges: "" };

const fromDetail = (z: ZoneDetailApi): Form => ({
  name: z.name,
  enabled: z.enabled,
  codAllowed: z.codAllowed,
  country: z.areas.country,
  states: z.areas.states.map((s) => s.name),
  cities: z.areas.cities.map((c) => `${c.city}, ${c.state}`).join("\n"),
  postalCodes: z.areas.postalCodes.join(", "),
  postalRanges: z.areas.postalRanges.map((r) => `${r.from}-${r.to}`).join("\n"),
});

const summary = (a: ZoneApi["areaSummary"]) =>
  a.country ? "All of India" : [a.states && `${a.states} state${a.states === 1 ? "" : "s"}`, a.cities && `${a.cities} cit${a.cities === 1 ? "y" : "ies"}`, a.postalCodes && `${a.postalCodes} PIN code${a.postalCodes === 1 ? "" : "s"}`, a.postalRanges && `${a.postalRanges} PIN range${a.postalRanges === 1 ? "" : "s"}`].filter(Boolean).join(" · ") || "No areas";

/**
 * Create, edit and delete shipping zones. A zone covers all of India, states, cities, single PIN codes or PIN ranges. The API
 * refuses conflicting zones (two zones covering the same place) so an address always falls in exactly one zone.
 */
export function ZoneManager({ zones, details, canManage }: { zones: ZoneApi[]; details: Record<string, ZoneDetailApi>; canManage: boolean }) {
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const form = editing?.form ?? blank;

  return (
    <div className="space-y-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setEditing({ id: null, form: blank })}>
            <Plus aria-hidden /> Add zone
          </Button>
        </div>
      ) : null}
      {zones.length === 0 ? (
        <p className="rounded-md border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">No zones yet. Without zones, checkout neither charges nor restricts delivery.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {zones.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {z.name} {!z.enabled ? <StatusBadge tone="draft" className="ml-1">Not served</StatusBadge> : null}
                </p>
                <p className="text-sm text-muted-foreground">{summary(z.areaSummary)}</p>
                <p className="text-xs text-muted-foreground">
                  {z.methodCount} delivery method{z.methodCount === 1 ? "" : "s"} · COD {z.codAllowed ? "allowed" : "not allowed"}
                </p>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => details[z.id] && setEditing({ id: z.id, form: fromDetail(details[z.id]!) })}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <ActionButton variant="ghost" action={() => deleteZoneAction(z.id)} success="Zone deleted" confirm={`Delete the zone "${z.name}" and its delivery methods?`}>
                    <Trash2 aria-hidden /> Delete
                  </ActionButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ActionDialog
          key={editing.id ?? "new"}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={editing.id ? "Edit zone" : "Add zone"}
          description="Choose where this zone delivers. An address belongs to the most specific zone that covers it: a PIN code, then a city, then a state, then all of India."
          submitLabel={editing.id ? "Save zone" : "Add zone"}
          success="Zone saved"
          wide
          onSubmit={() => saveZoneAction(editing.id, form)}
        >
          <FormField id="zn-name" label="Zone name" required>
            <Input id="zn-name" value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> We deliver to this zone</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.codAllowed} onChange={(e) => set({ codAllowed: e.target.checked })} /> Allow cash on delivery</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.country} onChange={(e) => set({ country: e.target.checked })} /> All of India (everywhere else)</label>
          </div>
          {!form.country ? (
            <>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">States and union territories</legend>
                <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 text-sm sm:grid-cols-2">
                  {INDIAN_STATE_NAMES.map((s) => (
                    <label key={s} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.states.includes(s)} onChange={(e) => set({ states: e.target.checked ? [...form.states, s] : form.states.filter((x) => x !== s) })} /> {s}
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormField id="zn-cities" label="Cities" optional hint="One per line, as: City, State">
                <Textarea id="zn-cities" rows={3} value={form.cities} onChange={(e) => set({ cities: e.target.value })} placeholder={"Mysuru, Karnataka\nPune, Maharashtra"} />
              </FormField>
              <FormField id="zn-pins" label="PIN codes" optional hint="Separate with commas, spaces or new lines.">
                <Textarea id="zn-pins" rows={2} value={form.postalCodes} onChange={(e) => set({ postalCodes: e.target.value })} placeholder="560001, 560002" />
              </FormField>
              <FormField id="zn-ranges" label="PIN code ranges" optional hint="One per line, inclusive, as: 560001-560099">
                <Textarea id="zn-ranges" rows={2} value={form.postalRanges} onChange={(e) => set({ postalRanges: e.target.value })} placeholder="560001-560099" />
              </FormField>
            </>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
