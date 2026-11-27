"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changePasswordAction, getProfileAction, loginCustomerAction, registerCustomerAction, updateProfileAction } from "@/app/s/[slug]/account/actions";
import type { CustomerProfileApi } from "@/lib/api/endpoints/customer-account-api";
import { cn } from "@/lib/utils";
import { changePasswordSchema, loginSchema, profileSchema, registerSchema } from "@/lib/validations/customer";
import type { SectionProps } from "../engine/looks";
import { Field, INPUT, MUTED, Notice, PageTitle, PRIMARY_BUTTON, SECONDARY_BUTTON, SHELL, pageStyle } from "../checkout/checkout-ui";
import { AccountAddresses } from "./account-addresses";
import { AccountOrderDetail, AccountOrders } from "./account-orders";
import { AccountFrame, Skeleton, useSignInRedirect } from "./account-shell";

/**
 * Every page of the shopper's account area (sign in, create an account, overview, orders, one order, addresses) is this one
 * section, told which `view` to show. The pages that need a signed-in shopper are checked on the server before they render;
 * what each view shows is read through server actions that send the shopper's own session to the API.
 */
export function AccountSection({ context, sectionId }: SectionProps) {
  const storeSlug = context.store.slug;
  const view = String(context.resource?.view ?? "home");
  const next = typeof context.resource?.next === "string" ? context.resource.next : "/account";
  const orderNumber = Number(context.resource?.orderNumber);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-[50px]")} style={pageStyle(context.theme)} {...sfProps}>
      {view === "login" || view === "register" ? (
        <AuthView storeSlug={storeSlug} mode={view} next={next} storeName={context.store.name} />
      ) : view === "orders" ? (
        <AccountFrame storeSlug={storeSlug} title="Your orders" crumbs={[{ label: "Account", href: "/account" }, { label: "Orders" }]}>
          <AccountOrders storeSlug={storeSlug} />
        </AccountFrame>
      ) : view === "order" ? (
        <AccountFrame storeSlug={storeSlug} title={`Order #${Number.isInteger(orderNumber) ? orderNumber : ""}`} crumbs={[{ label: "Account", href: "/account" }, { label: "Orders", href: "/account/orders" }, { label: `#${orderNumber}` }]}>
          <AccountOrderDetail storeSlug={storeSlug} storeName={context.store.name} orderNumber={orderNumber} />
        </AccountFrame>
      ) : view === "addresses" ? (
        <AccountFrame storeSlug={storeSlug} title="Saved addresses" crumbs={[{ label: "Account", href: "/account" }, { label: "Addresses" }]}>
          <AccountAddresses storeSlug={storeSlug} />
        </AccountFrame>
      ) : (
        <AccountFrame storeSlug={storeSlug} title="My account" crumbs={[{ label: "Account" }]}>
          <ProfileView storeSlug={storeSlug} />
        </AccountFrame>
      )}
    </section>
  );
}

/** Sign in or create an account for THIS store. Asked for at checkout only; the bag stays in the browser meanwhile. */
function AuthView({ storeSlug, mode, next, storeName }: { storeSlug: string; mode: "login" | "register"; next: string; storeName: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === "register";
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const toCheckout = next === "/checkout";
  const other = `${register ? "/account/login" : "/account/register"}${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const found: Record<string, string> = {};
    const parsed = register
      ? registerSchema.safeParse({ storeSlug, fullName: form.fullName, email: form.email, phone: form.phone || undefined, password: form.password })
      : loginSchema.safeParse({ storeSlug, email: form.email, password: form.password });
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    if (register && form.password !== form.confirm) found.confirm = "The passwords do not match.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    const r = register ? await registerCustomerAction(parsed.data) : await loginCustomerAction(parsed.data);
    if (!r.ok) {
      setBusy(false);
      if (r.fieldErrors) setErrors(r.fieldErrors);
      setFormError(r.error);
      return;
    }
    // Back to where they were going (checkout, with the bag still in this browser), or their account.
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-xl gap-8">
      <PageTitle crumbs={[{ label: "Home", href: "/" }, { label: register ? "Create account" : "Sign in" }]} title={register ? "Create account" : "Sign in"} />
      <p className={cn("text-[16px] leading-7", MUTED)}>
        {toCheckout ? "Sign in or create an account to place your order. Your bag is saved." : register ? `Create an account to order from ${storeName} and follow your deliveries.` : `Sign in to see your orders from ${storeName}.`}
      </p>
      <form onSubmit={submit} noValidate className="grid gap-6 rounded-[var(--pg-panel-radius,0px)] border border-border bg-white p-6 shadow-[var(--pg-panel-shadow,none)] sm:p-10">
        {formError ? <Notice tone="error">{formError}</Notice> : null}
        {register ? (
          <Field label="Full name" htmlFor="ac-name" error={errors.fullName}>
            <input id="ac-name" className={INPUT} autoComplete="name" value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} aria-invalid={!!errors.fullName} />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="ac-email" error={errors.email}>
          <input id="ac-email" type="email" inputMode="email" className={INPUT} autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email} />
        </Field>
        {register ? (
          <Field label="Mobile number (optional)" htmlFor="ac-phone" error={errors.phone}>
            <input id="ac-phone" type="tel" inputMode="tel" className={INPUT} autoComplete="tel" placeholder="10-digit mobile" value={form.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!errors.phone} />
          </Field>
        ) : null}
        <Field label="Password" htmlFor="ac-password" error={errors.password}>
          <input id="ac-password" type="password" className={INPUT} autoComplete={register ? "new-password" : "current-password"} value={form.password} onChange={(e) => set({ password: e.target.value })} aria-invalid={!!errors.password} />
        </Field>
        {register ? (
          <Field label="Confirm password" htmlFor="ac-confirm" error={errors.confirm}>
            <input id="ac-confirm" type="password" className={INPUT} autoComplete="new-password" value={form.confirm} onChange={(e) => set({ confirm: e.target.value })} aria-invalid={!!errors.confirm} />
          </Field>
        ) : null}
        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {busy ? (register ? "Creating account…" : "Signing in…") : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className={cn("text-[15px]", MUTED)}>
        {register ? "Already have an account? " : "New here? "}
        <Link href={other} className="text-foreground underline underline-offset-4">
          {register ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

/** Name, phone and password. The email is the sign-in identity and is shown, not edited. */
function ProfileView({ storeSlug }: { storeSlug: string }) {
  const signIn = useSignInRedirect();
  const [profile, setProfile] = useState<CustomerProfileApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwMessage, setPwMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void getProfileAction({ storeSlug }).then((r) => {
      if (!live || signIn(r)) return;
      if (!r.ok || !r.data) return setLoadError(r.ok ? "Your profile could not be loaded." : r.error);
      setProfile(r.data);
      setForm({ fullName: r.data.fullName, phone: r.data.phone ?? "" });
    });
    return () => {
      live = false;
    };
  }, [storeSlug, signIn]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMessage(null);
    const parsed = profileSchema.safeParse({ storeSlug, ...form });
    const found: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    setErrors(found);
    if (!parsed.success) return;
    setSaving(true);
    const r = await updateProfileAction(parsed.data);
    setSaving(false);
    if (signIn(r)) return;
    if (!r.ok || !r.data) {
      if (!r.ok && r.fieldErrors) setErrors(r.fieldErrors);
      return setMessage({ tone: "error", text: r.ok ? "Your details could not be saved." : r.error });
    }
    setProfile(r.data);
    setMessage({ tone: "success", text: "Your details were saved." });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwBusy) return;
    setPwMessage(null);
    const found: Record<string, string> = {};
    const parsed = changePasswordSchema.safeParse({ storeSlug, currentPassword: pw.currentPassword, newPassword: pw.newPassword });
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    if (pw.newPassword !== pw.confirm) found.confirm = "The passwords do not match.";
    setPwErrors(found);
    if (!parsed.success || Object.keys(found).length) return;
    setPwBusy(true);
    const r = await changePasswordAction(parsed.data);
    setPwBusy(false);
    if (signIn(r)) return;
    if (!r.ok) {
      if (r.fieldErrors) setPwErrors(r.fieldErrors);
      return setPwMessage({ tone: "error", text: r.error });
    }
    setPw({ currentPassword: "", newPassword: "", confirm: "" });
    setPwMessage({ tone: "success", text: "Your password was changed. Other devices were signed out." });
  }

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!profile) return <Skeleton label="Loading your account" />;

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <form onSubmit={save} noValidate className="grid content-start gap-5">
        <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Your details</h2>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Field label="Full name" htmlFor="pf-name" error={errors.fullName}>
          <input id="pf-name" className={INPUT} autoComplete="name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} aria-invalid={!!errors.fullName} />
        </Field>
        <Field label="Email" htmlFor="pf-email">
          <input id="pf-email" className={INPUT} value={profile.email} readOnly aria-readonly="true" />
        </Field>
        <Field label="Mobile number" htmlFor="pf-phone" error={errors.phone}>
          <input id="pf-phone" type="tel" inputMode="tel" className={INPUT} autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} aria-invalid={!!errors.phone} />
        </Field>
        <button type="submit" className={cn(PRIMARY_BUTTON, "sm:max-w-xs")} disabled={saving}>
          {saving ? "Saving…" : "Save details"}
        </button>
      </form>

      <div className="grid content-start gap-12">
        <form onSubmit={changePassword} noValidate className="grid gap-5">
          <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Change password</h2>
          {pwMessage ? <Notice tone={pwMessage.tone}>{pwMessage.text}</Notice> : null}
          <Field label="Current password" htmlFor="pw-current" error={pwErrors.currentPassword}>
            <input id="pw-current" type="password" className={INPUT} autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} aria-invalid={!!pwErrors.currentPassword} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={pwErrors.newPassword}>
            <input id="pw-new" type="password" className={INPUT} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} aria-invalid={!!pwErrors.newPassword} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm" error={pwErrors.confirm}>
            <input id="pw-confirm" type="password" className={INPUT} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} aria-invalid={!!pwErrors.confirm} />
          </Field>
          <button type="submit" className={cn(SECONDARY_BUTTON, "sm:max-w-xs")} disabled={pwBusy}>
            {pwBusy ? "Changing…" : "Change password"}
          </button>
        </form>

        <div className="grid gap-3 text-[16px]">
          <h2 className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.2em)]", MUTED)}>Shortcuts</h2>
          <Link href="/account/orders" className="underline underline-offset-4">
            Your orders and tracking
          </Link>
          <Link href="/account/addresses" className="underline underline-offset-4">
            Saved addresses
          </Link>
        </div>
      </div>
    </div>
  );
}
