import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { notFound } from "next/navigation";
import { getRequestStoreSlug } from "@/lib/tenant/request";
import { safeNextPath } from "@/lib/utils/redirect";
import { getPublicBranding } from "@/services/platform-settings.service";
import { getPublicStorefront } from "@/services/storefront.service";

// On a tenant host the tab names the store, not the platform (absolute skips the root "%s | Platform" template).
export async function generateMetadata(): Promise<Metadata> {
  const slug = await getRequestStoreSlug();
  const store = slug ? await getPublicStorefront(slug) : null;
  return { title: store ? { absolute: `Sign in | ${store.name}` } : "Sign in" };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  // <store>.<root>/login: only for a store that exists and is live (unknown / suspended -> 404).
  const slug = await getRequestStoreSlug();
  const [store, brand] = await Promise.all([slug ? getPublicStorefront(slug) : Promise.resolve(null), getPublicBranding()]);
  if (slug && !store) notFound();
  return (
    <AuthShell
      brandName={store?.name}
      title={store ? `Sign in to ${store.name}` : "Sign in"}
      description="Sign in with the email and password you were given."
      footer={
        <>
          {/* A store's own sign-in is for that store's team; creating a new store account belongs to the main site. */}
          {store ? null : (
            <span className="block">
              New here?{" "}
              <Link href="/signup" className="font-semibold text-lp-primary underline-offset-4 hover:underline">
                Get started
              </Link>
            </span>
          )}
          {brand.supportEmail ? <span className="mt-1 block">Need help? Contact {brand.supportEmail}.</span> : null}
        </>
      }
    >
      {error === "callback" ? (
        <Alert variant="destructive">
          <Info aria-hidden />
          <AlertDescription>Your session could not be verified. Please sign in again.</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
    </AuthShell>
  );
}
