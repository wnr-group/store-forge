import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ROUTES } from "@/config/app";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in via /auth/callback; no session = no reset.
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.forgotPassword}?error=expired`);

  return (
    <AuthShell
      icon={<KeyRound className="size-5" aria-hidden />}
      title="Choose a new password"
      description="Pick something strong you do not use elsewhere."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
