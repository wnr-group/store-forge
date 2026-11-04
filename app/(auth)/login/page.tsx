import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/config/app";
import { safeNextPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage your store."
      footer={
        <>
          New to StoreForge?{" "}
          <Link href={ROUTES.register} className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error === "callback" ? (
        <Alert variant="destructive">
          <Info aria-hidden />
          <AlertDescription>That link is invalid or has expired. Please sign in or request a new one.</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
    </AuthShell>
  );
}
