import type { Metadata } from "next";
import { Info } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { notFound } from "next/navigation";
import { getRequestStoreSlug } from "@/lib/tenant/request";
import { safeNextPath } from "@/lib/utils/redirect";
import { getPublicStorefront } from "@/services/storefront.service";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  // <store>.<root>/login: only for a store that exists and is live (unknown / suspended -> 404).
  const slug = await getRequestStoreSlug();
  const store = slug ? await getPublicStorefront(slug) : null;
  if (slug && !store) notFound();
  return (
    <AuthShell
      title={store ? `Sign in to ${store.name}` : "Sign in"}
      description="Sign in with the email and password you were given."
      footer="Accounts are created for you by your StoreForge administrator or company owner. Forgot your password? Ask your company owner to reset it."
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
