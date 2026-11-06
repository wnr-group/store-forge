import { ArrowRight, Globe, Image as ImageIcon, LayoutGrid, Lock, ShieldCheck, Sparkles, Store, TextCursorInput, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fade, ScaleIn, Wipe } from "./effects";
import { Container, Section } from "./ui";

/**
 * Only what the product really does today: a store name, logo and description, products with photos, prices and sale
 * prices, and a public storefront on the company's own subdomain. There is no colour, font, banner or theme editing, so
 * none is advertised here.
 */
const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Store, title: "Your logo and store name", text: "Put your own identity at the top of your storefront." },
  { icon: TextCursorInput, title: "Your store description", text: "Tell shoppers what your store is about." },
  { icon: LayoutGrid, title: "Clean product presentation", text: "Photos, prices and sale prices in a tidy grid." },
  { icon: Globe, title: "A storefront of your own", text: "Each company gets its own public storefront address." },
];

const SUPPORT: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Sparkles, title: "Reflect Your Brand", text: "Build a recognizable storefront appearance." },
  { icon: ShieldCheck, title: "Consistent Experience", text: "Keep your store presentation visually aligned." },
  { icon: LayoutGrid, title: "Professional Presentation", text: "Create a clean and welcoming shopping experience." },
];

const PRODUCTS = [
  { name: "Linen shirt", price: "$48.00", was: null, tile: "bg-lp-accent/25" },
  { name: "Canvas tote", price: "$18.00", was: "$24.00", tile: "bg-lp-secondary" },
  { name: "Ceramic mug", price: "$16.50", was: null, tile: "bg-rose-100" },
  { name: "Wool throw", price: "$62.00", was: null, tile: "bg-emerald-100" },
  { name: "Desk lamp", price: "$39.00", was: null, tile: "bg-violet-100" },
  { name: "Notebook set", price: "$14.00", was: null, tile: "bg-orange-100" },
] as const;

/** Decorative storefront that mirrors the real one: logo and name, a description, and a grid of priced products. */
function StorefrontMockup() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border border-lp-border bg-white shadow-[0_30px_60px_-30px_rgba(18,40,31,0.35)]">
      <div className="flex items-center gap-3 border-b border-lp-border bg-lp-bg px-4 py-2.5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-lp-border" />
          ))}
        </div>
        <div className="mx-auto flex h-6 w-full max-w-60 items-center justify-center gap-1.5 rounded-md border border-lp-border bg-white text-[10px] text-lp-text">
          <Lock className="size-3" strokeWidth={1.75} />
          yourstore.example.com
        </div>
        <span className="hidden w-12 sm:block" />
      </div>

      <div className="flex items-center gap-3 border-b border-lp-border px-5 py-4">
        <span className="grid size-9 place-items-center rounded-md bg-lp-primary/10 text-lp-primary">
          <Store className="size-5" strokeWidth={1.75} />
        </span>
        <p className="text-lg font-semibold tracking-tight text-lp-heading">Your Store</p>
      </div>

      <div className="px-5 py-6">
        <p className="max-w-md text-sm text-lp-text">Handpicked goods for everyday life, shipped from our small shop to your door.</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <li key={p.name} className="overflow-hidden rounded-lg border border-lp-border bg-white">
              <div className={cn("grid aspect-square place-items-center", p.tile)}>
                <ImageIcon className="size-5 text-lp-heading/25" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 p-2.5">
                <p className="truncate text-xs font-medium text-lp-heading">{p.name}</p>
                <p className="text-xs tabular-nums text-lp-heading">
                  {p.price}
                  {p.was ? <span className="ml-1.5 text-lp-text/70 line-through">{p.was}</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Personalization() {
  return (
    <Section id="personalization" className="bg-white py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[5fr_6fr] lg:gap-16">
          <div>
            <Fade as="p" className="text-sm font-medium tracking-wide text-lp-primary">YOUR STORE. YOUR BRAND.</Fade>
            <Fade delay={0.1}>
              <h2 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-lp-heading sm:text-[2.6rem]">Make your online store feel like your brand.</h2>
            </Fade>
            <Fade delay={0.2}>
              <span aria-hidden className="mt-6 block h-0.5 w-14 bg-lp-primary" />
            </Fade>
            <Fade as="p" delay={0.3} className="mt-6 max-w-md text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
              Every business has its own identity. StoreForge helps you create a store experience that reflects your brand, with your own name, logo and products on a storefront of your own.
            </Fade>
            <ul className="mt-8 space-y-5">
              {HIGHLIGHTS.map((h, i) => (
                <Fade as="li" key={h.title} delay={0.4 + i * 0.1} className="group flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-lp-border bg-lp-bg text-lp-primary transition-colors duration-500 group-hover:border-lp-primary/40 group-hover:bg-white motion-reduce:transition-none">
                    <h.icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-lp-heading">{h.title}</h3>
                    <p className="mt-0.5 text-sm leading-5 text-lp-text">{h.text}</p>
                  </div>
                </Fade>
              ))}
            </ul>
            <Fade delay={0.8}>
              <a
                href="#features"
                className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lp-primary outline-none transition-colors duration-300 hover:text-lp-primary-hover focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                Explore Store Features
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
              </a>
            </Fade>
          </div>

          <Wipe from="top" duration={1.3} amount={0.25}>
            <StorefrontMockup />
          </Wipe>
        </div>

        <ul className="mt-20 grid gap-4 sm:grid-cols-3 lg:mt-28">
          {SUPPORT.map((s, i) => (
            <ScaleIn as="li" key={s.title} scale={0.96} y={0} delay={i * 0.12} amount={0.3} className="group">
              <div className="flex h-full items-start gap-4 rounded-2xl border border-lp-border bg-lp-bg p-6 transition-colors duration-500 group-hover:border-lp-primary/30 motion-reduce:transition-none">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-lp-primary ring-1 ring-lp-border">
                  <s.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-lp-heading">{s.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-lp-text">{s.text}</p>
                </div>
              </div>
            </ScaleIn>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
