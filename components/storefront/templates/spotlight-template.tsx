import Image from "next/image";
import Link from "next/link";
import { Store } from "lucide-react";
import { publicImageUrl } from "@/lib/storage/paths";
import type { TemplateProps } from "@/lib/templates/types";
import { cn } from "@/lib/utils";
import { ProductGrid } from "./product-grid";

/** A full-width hero banner above the product grid. Text sits on a dark overlay when a hero image is set. */
export function SpotlightTemplate({ store, settings }: TemplateProps) {
  const logo = publicImageUrl(store.logo_path);
  const hasImage = Boolean(settings.heroImageUrl);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <span className="hidden w-24 sm:block" aria-hidden />
          <div className="flex min-w-0 items-center gap-2">
            {logo ? (
              <Image src={logo} alt="" width={28} height={28} className="size-7 rounded-md object-cover" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Store className="size-4" aria-hidden />
              </span>
            )}
            <span className="truncate text-sm font-semibold tracking-tight">{store.name}</span>
          </div>
          <Link href="/login" className="shrink-0 text-right text-sm text-muted-foreground hover:text-foreground hover:underline sm:w-24">
            Store login
          </Link>
        </div>
      </header>

      <section className="relative isolate flex min-h-72 items-center justify-center overflow-hidden bg-muted px-4 py-16 text-center">
        {hasImage ? (
          <>
            <Image src={settings.heroImageUrl!} alt="" fill sizes="100vw" className="-z-10 object-cover" />
            <div className="absolute inset-0 -z-10 bg-black/50" aria-hidden />
          </>
        ) : null}
        <div className={cn("mx-auto max-w-2xl space-y-3", hasImage ? "text-white" : "text-foreground")}>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{settings.heading}</h1>
          {settings.subheading ? <p className="text-base opacity-90">{settings.subheading}</p> : null}
          <span aria-hidden className="mx-auto block h-1 w-16 rounded-full bg-primary" style={settings.accentColor ? { backgroundColor: settings.accentColor } : undefined} />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <ProductGrid store={store} accent={settings.accentColor} />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">{store.name} · Powered by StoreForge</footer>
    </div>
  );
}
