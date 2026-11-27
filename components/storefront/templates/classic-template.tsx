import Image from "next/image";
import { Store } from "lucide-react";
import { publicImageUrl } from "@/lib/storage/paths";
import type { TemplateProps } from "@/lib/templates/types";
import { ProductGrid } from "./product-grid";

/** The original StoreForge storefront. With no customization its markup is identical to the pre-templates page. */
export function ClassicTemplate({ store, settings }: TemplateProps) {
  const logo = publicImageUrl(store.logo_path);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b" style={settings.accentColor ? { borderColor: settings.accentColor } : undefined}>
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          {logo ? (
            <Image src={logo} alt="" width={36} height={36} className="size-9 rounded-md object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Store className="size-5" aria-hidden />
            </span>
          )}
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{settings.heading}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {settings.heroImageUrl ? (
          <div className="relative mb-8 aspect-[16/5] overflow-hidden rounded-xl bg-muted">
            <Image src={settings.heroImageUrl} alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
          </div>
        ) : null}
        {settings.subheading ? <p className="mb-8 max-w-2xl text-muted-foreground">{settings.subheading}</p> : null}
        <ProductGrid store={store} accent={settings.accentColor} />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">{store.name} · Powered by StoreForge</footer>
    </div>
  );
}
