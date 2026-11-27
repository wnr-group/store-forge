"use client";

import { useEffect, useState } from "react";
import { addAddressAction, deleteAddressAction, listAddressesAction, updateAddressAction } from "@/app/s/[slug]/account/actions";
import type { CustomerAddressApi } from "@/lib/api/endpoints/customer-account-api";
import { INDIAN_STATE_NAMES } from "@/lib/checkout/states";
import { cn } from "@/lib/utils";
import { savedAddressSchema } from "@/lib/validations/customer";
import { Field, INPUT, MUTED, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../checkout/checkout-ui";
import { Skeleton, useSignInRedirect } from "./account-shell";

type Draft = { id: string | null; label: string; fullName: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string; isDefault: boolean };

const BLANK: Draft = { id: null, label: "", fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", isDefault: false };

const draftOf = (a: CustomerAddressApi): Draft => ({ id: a.id, label: a.label ?? "", fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, postalCode: a.postalCode, isDefault: a.isDefault });

/** The shopper's saved delivery addresses: add, change, remove, choose the default. Checkout offers them as one-click choices. */
export function AccountAddresses({ storeSlug }: { storeSlug: string }) {
  const signIn = useSignInRedirect();
  const [list, setList] = useState<CustomerAddressApi[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void listAddressesAction({ storeSlug }).then((r) => {
      if (!live || signIn(r)) return;
      if (r.ok && r.data) setList(r.data);
      else setLoadError(r.ok ? "Your addresses could not be loaded." : r.error);
    });
    return () => {
      live = false;
    };
  }, [storeSlug, signIn]);

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setMessage(null);
    const address = { label: draft.label || undefined, fullName: draft.fullName, phone: draft.phone, line1: draft.line1, line2: draft.line2 || undefined, city: draft.city, state: draft.state, postalCode: draft.postalCode, isDefault: draft.isDefault };
    const parsed = savedAddressSchema.safeParse(address);
    const found: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    setErrors(found);
    if (!parsed.success) return;
    setBusy(true);
    const r = draft.id ? await updateAddressAction({ storeSlug, id: draft.id, address: parsed.data }) : await addAddressAction({ storeSlug, address: parsed.data });
    setBusy(false);
    if (signIn(r)) return;
    if (!r.ok || !r.data) {
      if (!r.ok && r.fieldErrors) setErrors(r.fieldErrors);
      return setMessage({ tone: "error", text: r.ok ? "The address could not be saved." : r.error });
    }
    setList(r.data);
    setDraft(null);
    setMessage({ tone: "success", text: "Address saved." });
  }

  async function remove(a: CustomerAddressApi) {
    if (busy || !window.confirm("Remove this address?")) return;
    setBusy(true);
    setMessage(null);
    const r = await deleteAddressAction({ storeSlug, id: a.id });
    setBusy(false);
    if (signIn(r)) return;
    if (r.ok && r.data) {
      setList(r.data);
      setMessage({ tone: "success", text: "Address removed." });
    } else setMessage({ tone: "error", text: r.ok ? "The address could not be removed." : r.error });
  }

  async function makeDefault(a: CustomerAddressApi) {
    if (busy) return;
    setBusy(true);
    const r = await updateAddressAction({ storeSlug, id: a.id, address: { label: a.label ?? undefined, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? undefined, city: a.city, state: a.state, postalCode: a.postalCode, isDefault: true } });
    setBusy(false);
    if (signIn(r)) return;
    if (r.ok && r.data) setList(r.data);
    else setMessage({ tone: "error", text: r.ok ? "The default address could not be changed." : r.error });
  }

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!list) return <Skeleton label="Loading your addresses" />;

  return (
    <div className="grid gap-8">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {list.length === 0 && !draft ? (
        <div className="grid justify-items-start gap-4">
          <p className="text-[17px]">You have no saved addresses yet.</p>
          <p className={cn("max-w-md text-[16px] leading-7", MUTED)}>Save an address here and pick it with one click at checkout.</p>
        </div>
      ) : null}

      {list.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="grid content-between gap-4 border border-border bg-white rounded-[var(--pg-panel-radius,0px)] shadow-[var(--pg-panel-shadow,none)] p-5 text-[16px]">
              <div className="grid gap-1">
                <p className="flex items-center gap-3">
                  <span className="font-medium">{a.label || a.fullName}</span>
                  {a.isDefault ? <span className="border border-foreground px-2 py-0.5 text-[12px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.14em)]">Default</span> : null}
                </p>
                {a.label ? <p>{a.fullName}</p> : null}
                <p>{[a.line1, a.line2].filter(Boolean).join(", ")}</p>
                <p>
                  {a.city}, {a.state} {a.postalCode}
                </p>
                <p className={MUTED}>{a.phone}</p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.14em)]">
                <button type="button" className="underline underline-offset-4" onClick={() => (setErrors({}), setDraft(draftOf(a)))}>
                  Edit
                </button>
                {!a.isDefault ? (
                  <button type="button" className="underline underline-offset-4" onClick={() => void makeDefault(a)} disabled={busy}>
                    Make default
                  </button>
                ) : null}
                <button type="button" className="text-destructive underline underline-offset-4" onClick={() => void remove(a)} disabled={busy}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {draft ? (
        <form onSubmit={save} noValidate className="grid max-w-2xl gap-5 border border-border bg-white rounded-[var(--pg-panel-radius,0px)] shadow-[var(--pg-panel-shadow,none)] p-6">
          <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>{draft.id ? "Edit address" : "New address"}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Label (optional)" htmlFor="ad-label" error={errors.label}>
              <input id="ad-label" className={INPUT} placeholder="Home, Work…" value={draft.label} onChange={(e) => set({ label: e.target.value })} />
            </Field>
            <Field label="Full name" htmlFor="ad-name" error={errors.fullName}>
              <input id="ad-name" className={INPUT} autoComplete="name" value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} aria-invalid={!!errors.fullName} />
            </Field>
          </div>
          <Field label="Mobile number" htmlFor="ad-phone" error={errors.phone}>
            <input id="ad-phone" type="tel" inputMode="tel" className={INPUT} autoComplete="tel" placeholder="10-digit mobile" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Address" htmlFor="ad-line1" error={errors.line1}>
            <input id="ad-line1" className={INPUT} autoComplete="address-line1" value={draft.line1} onChange={(e) => set({ line1: e.target.value })} aria-invalid={!!errors.line1} />
          </Field>
          <Field label="Apartment, suite, landmark (optional)" htmlFor="ad-line2" error={errors.line2}>
            <input id="ad-line2" className={INPUT} autoComplete="address-line2" value={draft.line2} onChange={(e) => set({ line2: e.target.value })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="City" htmlFor="ad-city" error={errors.city}>
              <input id="ad-city" className={INPUT} autoComplete="address-level2" value={draft.city} onChange={(e) => set({ city: e.target.value })} aria-invalid={!!errors.city} />
            </Field>
            <Field label="State" htmlFor="ad-state" error={errors.state}>
              <select id="ad-state" className={INPUT} value={draft.state} onChange={(e) => set({ state: e.target.value })} aria-invalid={!!errors.state}>
                <option value="">Select</option>
                {INDIAN_STATE_NAMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="PIN code" htmlFor="ad-pin" error={errors.postalCode}>
              <input id="ad-pin" inputMode="numeric" maxLength={6} className={INPUT} autoComplete="postal-code" value={draft.postalCode} onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, "") })} aria-invalid={!!errors.postalCode} />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-[16px]">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} />
            Use as my default address
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={cn(PRIMARY_BUTTON, "sm:w-48")} disabled={busy}>
              {busy ? "Saving…" : "Save address"}
            </button>
            <button type="button" className={cn(SECONDARY_BUTTON, "sm:w-32")} onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={cn(SECONDARY_BUTTON, "sm:w-56")} onClick={() => (setErrors({}), setMessage(null), setDraft({ ...BLANK, isDefault: list.length === 0 }))} disabled={list.length >= 10}>
          {list.length >= 10 ? "Address limit reached" : "Add an address"}
        </button>
      )}
    </div>
  );
}
