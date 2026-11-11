import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Templates" };

// Template customization is paused until the StoreForge API offers it. The public storefront still renders each store's saved template through the API.
export default function TemplatesPage() {
  return (
    <>
      <PageHeader title="Templates" description="Choose how your public storefront looks." />
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Palette}
          title="Coming soon"
          description="Storefront templates and customization are on the way. Your public storefront keeps working as it does today."
        />
      </div>
    </>
  );
}
