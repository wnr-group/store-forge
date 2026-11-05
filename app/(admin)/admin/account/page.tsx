import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export const metadata: Metadata = { title: "Account" };

export default function AdminAccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your Platform Admin sign-in." />
      <div className="mx-auto max-w-3xl">
        <ChangePasswordForm />
      </div>
    </>
  );
}
