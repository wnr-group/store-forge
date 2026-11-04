import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthShell
      icon={<MailCheck className="size-5" aria-hidden />}
      title="Check your email"
      description={
        email
          ? `We sent a verification link to ${email}. Click it to activate your account.`
          : "We sent you a verification link. Click it to activate your account."
      }
    >
      <p className="text-center text-sm text-muted-foreground">
        Once verified you will be signed in and can set up your store. Did not get it? Check your spam folder.
      </p>
      <Link href={ROUTES.login} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
        Go to sign in
      </Link>
    </AuthShell>
  );
}
