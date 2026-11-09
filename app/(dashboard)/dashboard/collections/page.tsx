import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Layers, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { publicImageUrl } from "@/lib/storage/paths";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listCollections } from "@/services/collection.service";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const { active } = await requireWorkspaceCan("catalog:view");
  const rows = await listCollections();
  const add = canManageCatalog(active) ? (
    <Link href={`${ROUTES.collections}/new`} className={buttonVariants()}>
      <Plus aria-hidden /> Add collection
    </Link>
  ) : null;

  return (
    <>
      <PageHeader title="Collections" description="Group products for merchandising, like Summer sale or New arrivals." actions={rows.length ? add : null} />
      {rows.length === 0 ? (
        <EmptyState icon={Layers} title="No collections yet" description="Create a collection and hand-pick the products that belong in it." action={add} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((c) => {
            const src = publicImageUrl(c.imagePath);
            return (
              <li key={c.id}>
                <Link href={`${ROUTES.collections}/${c.id}`} className="group block overflow-hidden rounded-lg border bg-card transition-shadow outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="relative flex aspect-[16/9] items-center justify-center bg-muted text-muted-foreground">
                    {src ? <Image src={src} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 100vw" className="object-cover" /> : <ImageIcon className="size-6" aria-hidden />}
                  </div>
                  <div className="space-y-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-medium group-hover:underline">{c.name}</h3>
                      <StatusBadge tone={c.status === "active" ? "active" : "draft"}>{c.status === "active" ? "Active" : "Draft"}</StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.productCount} product{c.productCount === 1 ? "" : "s"}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
