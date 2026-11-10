import type { Metadata } from "next";
import { CreateCompanyForm } from "@/components/admin/create-company-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Create organization" };

export default function NewCompanyPage() {
  return (
    <>
      <PageHeader title="Create organization" description="Creates the organization, its first store and the owner's sign-in in one step." />
      <CreateCompanyForm />
    </>
  );
}
