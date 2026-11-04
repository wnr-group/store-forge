import type { Metadata } from "next";
import { CreateCompanyForm } from "@/components/admin/create-company-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Create company" };

export default function NewCompanyPage() {
  return (
    <>
      <PageHeader title="Create company" description="Creates the company, its first store and the owner's sign-in in one step." />
      <CreateCompanyForm />
    </>
  );
}
