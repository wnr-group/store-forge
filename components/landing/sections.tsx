import Image from "next/image";
import { ArrowRight, BarChart3, Check, MessageCircle, PackageCheck, ShoppingBag, Smartphone, Store, Tag, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";
import { cn } from "@/lib/utils";
import { FeatureExplorer } from "./feature-explorer";
import { Container, Section, SectionHeading, lpButton } from "./ui";

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
          StoreForge helps you open an online store and run it day to day, without juggling tools.
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

const SHOP_POINTS = [
  {
    icon: Tag,
    title: "Discover exciting products",
    text: "Product photos, names, descriptions and prices, with sale prices shown clearly.",
    src: "/landing/shop-discover.webp",
    alt: "A smiling woman holding a cream cable-knit sweater up against herself in front of a boutique mirror",
    width: 1122,
    height: 1402,
    position: "40% 38%",
  },
  {
    icon: Smartphone,
    title: "Beautiful on any screen",
    text: "Your storefront looks great on phones, tablets and computers.",
    src: "/landing/shop-anyscreen.webp",
    alt: "A smiling man in glasses looking at his phone at a tram stop at golden hour, holding a coffee",
    width: 1400,
    height: 1120,
    position: "50% 40%",
  },
  {
    icon: Store,
    title: "A store that is yours",
    text: "Your own web address, with your name and logo on it.",
    src: "/landing/shop-yours.webp",
    alt: "A shop owner in a navy apron stamping a plain kraft-paper gift bag at her shop counter",
    width: 1448,
    height: 1086,
    position: "56% 45%",
  },
];

/**
 * An expanding photo gallery: three tall panels share the row, and the one under the pointer (or with keyboard focus)
 * widens while the others narrow. Each panel always shows its title and description, so nothing depends on hover.
 */
export function ShoppingExperience() {
  return (
    <Section id="solutions" className="border-y border-lp-border bg-lp-soft/70">
      <Container>
        <SectionHeading eyebrow="For your customers" title="A Better Shopping Experience Starts Here." align="center">
          Give your customers a clean, fast storefront where they can discover and browse everything you sell.
        </SectionHeading>

        <ol className="mt-14 flex flex-col gap-4 lg:h-[34rem] lg:flex-row lg:gap-5">
          {SHOP_POINTS.map((p, i) => (
            <li
              key={p.title}
              tabIndex={0}
              style={stagger(i)}
              className="lp-reveal group relative isolate flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-lp-border bg-lp-heading shadow-[0_28px_60px_-34px_rgba(23,43,66,0.6)] outline-none transition-[flex-grow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 motion-reduce:transition-none lg:min-h-0 lg:flex-1 lg:hover:flex-[2.3] lg:focus-visible:flex-[2.3]"
            >
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                style={{ objectPosition: p.position }}
                className="-z-10 object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.06]"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0f1d2e]/90 via-[#0f1d2e]/30 to-transparent" aria-hidden />

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
                <span className="inline-flex w-fit rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold tabular-nums text-lp-primary">0{i + 1}</span>
                <div>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-lp-accent text-lp-heading">
                    <p.icon className="size-5" strokeWidth={1.9} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">{p.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-white/85">{p.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="lp-reveal mt-12 flex justify-center">
          <a href={ROUTES.login} className={lpButton("primary", "h-12 px-7 text-[15px]")}>
            Start Your Store <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ How it works */

const STEPS = [
  {
    title: "Create Your Store",
    text: "Your company, store and owner account are set up for you, ready to go.",
    points: ["Your store name, logo and details", "An owner login that is ready to use", "Its own web address"],
    src: "/landing/step-kitchen.webp",
    alt: "A smiling man in glasses setting up his online store on a laptop at a sunny kitchen table, with a notebook of sketches beside him",
    position: "58% 40%",
    tone: "border-lp-border bg-white text-lp-heading",
    muted: "text-lp-text",
    numeral: "text-lp-primary/15",
    tick: "text-lp-primary",
  },
  {
    title: "Add Your Products",
    text: "Add photos, prices and stock, and organise everything into categories and collections.",
    points: ["Photos, variants and prices", "Categories and collections", "Stock levels for every product"],
    src: "/landing/step-studio.webp",
    alt: "A woman in a navy apron photographing a handmade ceramic vase on a cream backdrop with a phone on a tripod and a softbox light",
    position: "52% 45%",
    tone: "border-lp-border bg-[#e9eff6] text-lp-heading",
    muted: "text-lp-text",
    numeral: "text-lp-primary/15",
    tick: "text-lp-primary",
  },
  {
    title: "Launch and Start Selling",
    text: "Share your store link, invite your team and keep an eye on sales as they come in.",
    points: ["Share your store link", "Invite your team", "Follow sales and stock"],
    src: "/landing/step-celebrate.webp",
    alt: "A woman and a man cheering together as they look at a phone, with stacked kraft-paper parcels ready to ship behind them",
    position: "50% 40%",
    tone: "border-lp-primary bg-lp-primary text-white",
    muted: "text-white/80",
    numeral: "text-white/15",
    tick: "text-lp-accent",
  },
];

/**
 * Three large cards that stack as you scroll: each one sticks in place and the next slides over it (large screens only;
 * on small screens they simply follow one another). The cards go white, soft blue, then brand navy.
 */
export function HowItWorks() {
  return (
    <Section id="how-it-works" className="bg-white">
      <Container>
        <SectionHeading eyebrow="How it works" title="Start Selling Online in Three Simple Steps." align="center">
          From a first login to your first sale, the path is short.
        </SectionHeading>

        <ol className="mt-14 space-y-6 lg:space-y-0">
          {STEPS.map((st, i) => (
            <li
              key={st.title}
              style={{ "--i": i } as React.CSSProperties}
              className={cn(
                "overflow-hidden rounded-3xl border shadow-[0_30px_60px_-36px_rgba(23,43,66,0.45)] lg:sticky lg:top-[calc(6rem+var(--i)*1.5rem)] lg:h-[26rem]",
                i < STEPS.length - 1 && "lg:mb-24",
                st.tone,
              )}
            >
              <div className={cn("grid h-full lg:grid-cols-2", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                <div className="relative flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                  <span className={cn("pointer-events-none absolute top-3 right-5 text-[5rem] leading-none font-semibold tracking-tighter select-none sm:text-[9rem]", st.numeral)} aria-hidden>
                    0{i + 1}
                  </span>
                  <p className="relative text-sm font-medium text-lp-accent">Step {i + 1}</p>
                  <h3 className="relative mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{st.title}</h3>
                  <p className={cn("relative mt-4 max-w-md text-base leading-7", st.muted)}>{st.text}</p>
                  <ul className="relative mt-6 space-y-2.5">
                    {st.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-3 text-sm font-medium">
                        <Check className={cn("size-4 shrink-0", st.tick)} strokeWidth={2.5} aria-hidden />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  {i === STEPS.length - 1 ? (
                    <a href={ROUTES.login} className={lpButton("light", "relative mt-8 h-11 w-fit")}>
                      Start Your Store <ArrowRight className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
                <div className="relative order-first aspect-[16/10] lg:order-none lg:aspect-auto">
                  <Image src={st.src} alt={st.alt} fill sizes="(min-width: 1024px) 560px, 100vw" style={{ objectPosition: st.position }} className="object-cover" />
                </div>
              </div>
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

