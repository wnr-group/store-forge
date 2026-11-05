import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";
import { getPublicStorefront } from "@/services/storefront.service";

/**
 * Public storefront, reached through the proxy rewrite from <slug>.<root domain>. Everything shown
 * comes from get_public_storefront(): public fields of an active store only.
 */
type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = await getPublicStorefront((await params).slug);
  return store ? { title: store.name, description: store.description ?? undefined } : { title: "Store not found" };
}

export default async function StorefrontPage({ params }: Params) {
  const { slug } = await params;
  // Also reachable as /s/<slug> on the main domain; the data is public either way.
  if (!slug || slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const logo = publicImageUrl(store.logo_path);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          {logo ? (
            <Image src={logo} alt="" width={36} height={36} className="size-9 rounded-md object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Store className="size-5" aria-hidden />
            </span>
          )}
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{store.name}</h1>
          <Link href="/login" className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline">
            Store login
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {store.description ? <p className="mb-8 max-w-2xl text-muted-foreground">{store.description}</p> : null}
        {store.products.length === 0 ? (
          <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">Products are coming soon.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {store.products.map((p) => {
              const img = publicImageUrl(p.image_path);
              const onSale = p.compare_at_price_minor !== null && p.compare_at_price_minor > p.price_minor;
              return (
                <li key={p.slug} className="overflow-hidden rounded-xl border bg-card">
                  <div className="relative aspect-square bg-muted">
                    {img ? <Image src={img} alt={p.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" /> : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <h2 className="truncate text-sm font-medium">{p.name}</h2>
                    {p.short_description ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.short_description}</p> : null}
                    <p className="text-sm">
                      <span className="font-semibold">{formatMoney(p.price_minor, store.currency)}</span>
                      {onSale ? <span className="ml-2 text-xs text-muted-foreground line-through">{formatMoney(p.compare_at_price_minor!, store.currency)}</span> : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">{store.name} · Powered by StoreForge</footer>
    </div>
  );
}
