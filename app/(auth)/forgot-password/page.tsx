import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/config/app";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your email and we will send you a reset link."
      footer={
        <Link href={ROUTES.login} className="font-medium text-foreground hover:underline">
          Back to sign in
        </Link>
      }
    >
      {error === "expired" ? (
        <Alert variant="destructive">
          <Info aria-hidden />
          <AlertDescription>Your reset link is invalid or has expired. Request a new one below.</AlertDescription>
        </Alert>
      ) : null}
      <ForgotPasswordForm />
    </AuthShell>
  );
}
