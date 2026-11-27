"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutCustomerAction } from "@/app/s/[slug]/account/actions";
import { cn } from "@/lib/utils";
import { MUTED, PageTitle, SHELL } from "../checkout/checkout-ui";
import type { ActionResult } from "@/types/action";

export const dateTime = (iso: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const dateOnly = (iso: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(iso));

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
];

/**
 * A server action answered "sign in first" (no session, or one the API ended): go to the sign-in page and come back here after.
 * Returns true when it redirected, so the caller stops.
 */
export function useSignInRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (r: ActionResult<unknown>) => {
      if (r.ok || r.code !== "UNAUTHENTICATED") return false;
      // `pathname` is the page's own path (on a store address it has no store prefix); only known account paths are accepted on return.
      router.replace(`/account/login?next=${encodeURIComponent(pathname)}`);
      return true;
    },
    [router, pathname],
  );
}

/** The signed-in area: title, the small account menu, and sign out. */
export function AccountFrame({ storeSlug, title, crumbs, children }: { storeSlug: string; title: string; crumbs: { label: string; href?: string }[]; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await logoutCustomerAction({ storeSlug });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <PageTitle crumbs={[{ label: "Home", href: "/" }, ...crumbs]} title={title} />
      <nav aria-label="Account" className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-4 text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.16em)]">
        {NAV.map((n) => {
          const active = n.href === "/account" ? pathname === "/account" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("py-1 transition-colors hover:text-foreground", active ? "border-b border-foreground text-foreground" : MUTED)}>
              {n.label}
            </Link>
          );
        })}
        <button type="button" onClick={signOut} className={cn("ml-auto py-1 [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.16em)] transition-colors hover:text-foreground", MUTED)}>
          Sign out
        </button>
      </nav>
      <div className="pt-8 md:pt-10">{children}</div>
    </>
  );
}

export function Skeleton({ label, className }: { label: string; className?: string }) {
  return <div className={cn("h-48 animate-pulse bg-secondary/60", className)} aria-busy="true" aria-label={label} />;
}

export { SHELL };
