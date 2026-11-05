import Image from "next/image";
import { ArrowRight, BarChart3, MessageCircle, PackageCheck, ShoppingBag, Smartphone, Store, Tag, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";
import { cn } from "@/lib/utils";
import { FeatureExplorer } from "./feature-explorer";
import { Container, Photo, Section, SectionHeading, lpButton } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

/* ------------------------------------------------------------------ Platform introduction */

type Capability = {
  icon: LucideIcon;
  title: string;
  text: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Grid placement on large screens and the focal point of the crop. */
  span: string;
  heightClass: string;
  position?: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: Store,
    title: "Create your online store",
    text: "Open a storefront of your own, with your name and logo, on its own web address.",
    src: "/landing/platform-store.webp",
    alt: "A smiling shop owner in a navy apron standing in the open doorway of a brick boutique at golden hour",
    width: 1400,
    height: 788,
    span: "md:col-span-2 lg:col-span-7",
    heightClass: "lg:h-[26rem]",
    position: "70% 40%",
  },
  {
    icon: PackageCheck,
    title: "Manage your products",
    text: "Keep photos, variants, prices and stock organised in one place.",
    src: "/landing/platform-products.webp",
    alt: "Overhead view of hands arranging a navy mug, a brass candle, a leather card holder and a cream scarf on a grey surface",
    width: 1200,
    height: 800,
    span: "lg:col-span-5",
    heightClass: "lg:h-[26rem]",
    position: "50% 50%",
  },
  {
    icon: ShoppingBag,
    title: "Organize orders",
    text: "See every order and where it stands, from new to fulfilled.",
    src: "/landing/platform-orders.webp",
    alt: "A man and a woman in navy aprons wrapping kraft-paper parcels together at a packing bench",
    width: 1200,
    height: 675,
    span: "lg:col-span-4",
    heightClass: "lg:h-[24rem]",
    position: "50% 30%",
  },
  {
    icon: MessageCircle,
    title: "Connect with customers",
    text: "Know who buys from you, how often and how much they spend.",
    src: "/landing/platform-customers.webp",
    alt: "A delighted customer opening a kraft-paper parcel tied with gold twine on a sofa at home",
    width: 1200,
    height: 675,
    span: "lg:col-span-4",
    heightClass: "lg:h-[24rem]",
    position: "55% 35%",
  },
  {
    icon: BarChart3,
    title: "Understand your business",
    text: "Follow your sales and spot your best sellers at a glance.",
    src: "/landing/platform-insights.webp",
    alt: "A man smiling as he works on a laptop at a wooden desk, with parcels and folded knitwear beside him",
    width: 900,
    height: 1125,
    span: "md:col-span-2 lg:col-span-4",
    heightClass: "lg:h-[24rem]",
    position: "50% 30%",
  },
];

function CapabilityTile({ c, index }: { c: Capability; index: number }) {
  return (
    <li style={stagger(index % 3)} className={cn("lp-reveal group relative isolate min-h-[20rem] overflow-hidden rounded-2xl border border-lp-border bg-lp-heading shadow-[0_24px_50px_-30px_rgba(23,43,66,0.5)] md:min-h-[22rem]", c.span, c.heightClass)}>
      <Image
        src={c.src}
        alt={c.alt}
        fill
        sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw"
        style={{ objectPosition: c.position }}
        className="-z-10 object-cover transition-transform duration-[900ms] ease-out motion-safe:group-hover:scale-[1.05]"
      />
      {/* Navy wash from the bottom so the caption always reads clearly */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0f1d2e]/90 via-[#0f1d2e]/35 to-transparent" aria-hidden />
      <div className="flex h-full flex-col justify-between p-5 sm:p-6">
        <span className="inline-flex w-fit items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold tabular-nums text-lp-primary">0{index + 1}</span>
        <div>
          <span className="flex size-10 items-center justify-center rounded-lg bg-lp-accent text-lp-heading">
            <c.icon className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">{c.title}</h3>
          <p className="mt-1.5 max-w-sm text-sm leading-6 text-white/85">{c.text}</p>
        </div>
      </div>
    </li>
  );
}

export function PlatformIntro() {
  return (
    <Section id="platform">
      <Container>
        <SectionHeading eyebrow="The platform" title="Everything Your Business Needs to Sell Online." align="center">
          StoreForge, from WNR, helps you open an online store and run it day to day, without juggling tools.
        </SectionHeading>

        <ol className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {CAPABILITIES.map((c, i) => (
            <CapabilityTile key={c.title} c={c} index={i} />
          ))}
        </ol>

        <div className="lp-reveal mt-12 flex justify-center">
          <a href="#features" className={lpButton("secondary", "h-11")}>
            See everything it can do <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ Key features */

export function FeatureShowcase() {
  return (
    <Section id="features" className="bg-lp-heading">
      <Container>
        <SectionHeading dark eyebrow="Features" title="Powerful Tools. Simpler Business Management." align="center">
          Everything you need to run your store, in one place. Pick a feature to see what it does for you.
        </SectionHeading>
        <div className="mt-14">
          <FeatureExplorer />
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ B2C shopping experience */

const SAMPLE_PRODUCTS = [
  { name: "Leather everyday bag", price: "₹3,499", src: "/landing/shop-bag.webp", alt: "A black leather handbag with sunglasses, a phone and essentials on a pink background" },
  { name: "Linen shirt collection", price: "₹1,299", was: "₹1,799", src: "/landing/shop-fashion.webp", alt: "Shirts and tops hanging on a clothing rail" },
  { name: "Everyday essentials", price: "₹2,799", src: "/landing/shop-essentials.webp", alt: "A watch, camera, notebook and earbuds arranged on a white surface" },
];

const SHOP_POINTS = [
  { icon: Tag, title: "Discover exciting products", text: "Product photos, names, descriptions and prices, with sale prices shown clearly." },
  { icon: Smartphone, title: "Beautiful on any screen", text: "Your storefront looks great on phones, tablets and computers." },
  { icon: Store, title: "A store that is yours", text: "Your own web address, with your name and logo on it." },
];

function ProductCard({ p, compact = false }: { p: (typeof SAMPLE_PRODUCTS)[number]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-lp-border bg-white">
      <Image src={p.src} alt={p.alt} width={900} height={600} sizes={compact ? "110px" : "(min-width: 1024px) 170px, 30vw"} className="aspect-[4/3] w-full object-cover" />
      <div className={compact ? "p-2" : "p-3"}>
        <p className={compact ? "truncate text-[11px] font-medium text-lp-heading" : "truncate text-sm font-medium text-lp-heading"}>{p.name}</p>
        <p className={compact ? "mt-0.5 text-[11px] text-lp-heading" : "mt-1 text-sm text-lp-heading"}>
          {p.price}
          {"was" in p && p.was && !compact ? <span className="ml-1.5 text-lp-text line-through">{p.was}</span> : null}
        </p>
      </div>
    </div>
  );
}

export function ShoppingExperience() {
  return (
    <Section id="solutions">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div>
            <SectionHeading eyebrow="For your customers" title="A Better Shopping Experience Starts Here.">
              Give your customers a clean, fast storefront where they can discover and browse everything you sell.
            </SectionHeading>
            <ul className="mt-8 space-y-5">
              {SHOP_POINTS.map((p, i) => (
                <li key={p.title} style={stagger(i)} className="lp-reveal flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lp-soft text-lp-primary">
                    <p.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-lp-heading">{p.title}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-lp-text">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <figure className="lp-reveal relative pb-6">
            <div className="overflow-hidden rounded-xl border border-lp-border bg-lp-bg shadow-[0_24px_60px_-22px_rgba(23,43,66,0.28)] sm:mr-36">
              <div className="flex h-9 items-center gap-1.5 border-b border-lp-border bg-white px-3.5">
                <span className="size-2.5 rounded-full bg-[#e2e8f0]" aria-hidden />
                <span className="size-2.5 rounded-full bg-[#e2e8f0]" aria-hidden />
                <span className="size-2.5 rounded-full bg-[#e2e8f0]" aria-hidden />
              </div>
              <div className="flex h-12 items-center border-b border-lp-border bg-white px-4 text-sm font-semibold text-lp-heading">Your store</div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {SAMPLE_PRODUCTS.map((p) => (
                  <ProductCard key={p.name} p={p} />
                ))}
              </div>
            </div>
            <div className="mx-auto mt-6 w-40 rounded-[1.75rem] border-[6px] border-lp-heading bg-lp-bg p-2 shadow-[0_24px_50px_-18px_rgba(23,43,66,0.4)] sm:absolute sm:right-0 sm:bottom-0 sm:mx-0 sm:mt-0">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-lp-heading/30" aria-hidden />
              <div className="mb-2 px-1 text-[11px] font-semibold text-lp-heading">Your store</div>
              <div className="grid grid-cols-2 gap-1.5">
                <ProductCard p={SAMPLE_PRODUCTS[0]} compact />
                <ProductCard p={SAMPLE_PRODUCTS[2]} compact />
              </div>
            </div>
            <figcaption className="mt-6 text-xs text-lp-text sm:mr-36">Illustration of a storefront with sample products on desktop and mobile.</figcaption>
          </figure>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { src: "/landing/shop-shoppers.webp", w: 1200, h: 675, alt: "Three smiling women carrying colourful shopping bags in a mall", caption: "Discover what is new" },
            { src: "/landing/shop-mobile.webp", w: 1200, h: 675, alt: "A woman on a sofa looking at her smartphone while holding a bank card", caption: "Browse from the sofa" },
            { src: "/landing/shop-boutique.webp", w: 900, h: 1600, alt: "Colourful garments on racks inside a bright fashion boutique", caption: "Find something you love", pos: "center 72%" },
          ].map((ph, i) => (
            <Photo key={ph.src} src={ph.src} alt={ph.alt} width={ph.w} height={ph.h} sizes="(min-width: 640px) 33vw, 100vw" caption={ph.caption} objectPosition={ph.pos} style={stagger(i)} className="lp-reveal aspect-[4/3]" />
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ How it works */

const STEPS = [
  { title: "Create Your Store", text: "Your company, store and owner account are set up for you, ready to go.", src: "/landing/step-create.webp", alt: "A woman at a laptop with a notebook, setting up her business", w: 1000, h: 563 },
  { title: "Add Your Products", text: "Add photos, prices and stock, and organise everything into categories and collections.", src: "/landing/step-products.webp", alt: "Two women carefully preparing products and gift packaging at a table", w: 1000, h: 668 },
  { title: "Launch and Start Selling", text: "Share your store link, invite your team and keep an eye on sales as they come in.", src: "/landing/step-orders.webp", alt: "A shop owner packing a customer's order at a desk with a laptop beside a rail of clothes", w: 1000, h: 668 },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="border-t border-lp-border bg-white">
      <Container>
        <SectionHeading eyebrow="How it works" title="Start Selling Online in Three Simple Steps." align="center" />
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} style={stagger(i)} className="lp-reveal">
              <Photo src={s.src} alt={s.alt} width={s.w} height={s.h} sizes="(min-width: 768px) 360px, 100vw" className="aspect-[4/3]" />
              <div className="mt-5 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-lp-primary text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="text-lg font-semibold text-lp-heading">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-lp-text md:pr-4">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ Final call to action */

export function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="lp-reveal relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-lp-heading">
        <Image src="/landing/cta-owner.webp" alt="A smiling business owner in an apron holding a Yes, we're open sign outside his shop" fill sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover object-[center_50%]" />
        <div className="absolute inset-0 bg-lp-heading/80 sm:bg-transparent sm:bg-gradient-to-r sm:from-lp-heading sm:from-35% sm:via-lp-heading/70 sm:via-55% sm:to-transparent" aria-hidden />
        <div className="relative px-6 py-16 sm:px-12 sm:py-28 lg:px-16">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl sm:leading-[1.15]">Your Business Deserves to Be Online.</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-white/85 sm:text-lg">Start building your online presence and create better shopping experiences with StoreForge.</p>
          <div className="mt-8">
            <a href={ROUTES.login} className={lpButton("light", "h-12 px-7 text-[15px]")}>
              Get Started <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

