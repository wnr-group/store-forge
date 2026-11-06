import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, LineChart, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import { Fade } from "@/components/landing/effects";
import { PageHero, PageShell } from "@/components/landing/page-shell";
import { Container, Section, SectionHeading, lpButton } from "@/components/landing/ui";
import { Reveal } from "@/components/landing/motion";

export const metadata: Metadata = {
  title: "About",
  description: "StoreForge is a commerce platform that brings an online seller's products, orders, customers and storefront into one place.",
};

const PRINCIPLES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Layers, title: "One place for the work", text: "Products, inventory, orders and customers live together, so running a store does not mean juggling separate tools." },
  { icon: Store, title: "A storefront of your own", text: "Every company gets its own catalog and a public storefront on its own subdomain, kept separate from every other company." },
  { icon: ShieldCheck, title: "Built to be trusted", text: "Access follows each person's role, and each company's data stays apart from everyone else's." },
  { icon: LineChart, title: "Clarity over noise", text: "Show what needs attention today, in plain language, so owners spend time selling instead of searching." },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero eyebrow="About StoreForge" title="Built for people who run online stores.">
        StoreForge is a multi-tenant commerce platform. It helps sellers create their store, manage the everyday work behind it, and give shoppers a better way to buy.
      </PageHero>

      <Section className="bg-white">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <SectionHeading eyebrow="Our mission" title="Make running a store feel simple.">
            Selling online should not require stitching together a catalog tool, a spreadsheet for stock and an inbox for orders. We are building one organized workspace for all of it.
          </SectionHeading>
          <Reveal className="space-y-5 text-base leading-7 text-lp-text sm:text-lg sm:leading-8">
            <p>StoreForge gives each business a secure workspace for products, categories, collections, inventory, customers and team members, alongside a storefront that shoppers can visit on its own subdomain.</p>
            <p>We keep the product focused on the daily jobs of an online seller and describe it honestly, so you always know what the platform does today.</p>
          </Reveal>
        </Container>
      </Section>

      <Section className="lp-paper bg-lp-bg">
        <Container>
          <SectionHeading eyebrow="What guides us" title="Four principles behind the product" align="center" />
          <ul className="mt-14 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title}>
                <Fade delay={i * 0.08} className="h-full">
                  <article className="group h-full rounded-2xl border border-lp-border bg-white p-7 transition-[translate,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-lp-primary/30 hover:shadow-[0_24px_48px_-24px_rgba(18,40,31,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className="grid size-11 place-items-center rounded-xl bg-lp-secondary text-lp-primary">
                      <p.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-lg font-bold text-lp-heading">{p.title}</h3>
                    <p className="mt-2 text-base leading-7 text-lp-text">{p.text}</p>
                    <span aria-hidden className="lp-gold-rule mt-6 block h-px w-14 transition-[width] duration-500 group-hover:w-24" />
                  </article>
                </Fade>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section className="bg-white">
        <Container>
          <Reveal className="relative isolate flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[2rem] bg-lp-primary px-8 py-12 sm:flex-row sm:items-center sm:px-12">
            <span aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 size-[22rem] rounded-full bg-[radial-gradient(circle,rgba(199,167,122,0.3),transparent_65%)]" />
            <div className="max-w-lg">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance text-white">Want to talk about your store?</h2>
              <p className="mt-3 text-base leading-7 text-white/75">We would be glad to hear what you are building.</p>
            </div>
            <Link href="/contact" className={lpButton("gold", "h-12 px-8 text-[15px] focus-visible:ring-offset-lp-primary")}>
              Contact us
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Reveal>
        </Container>
      </Section>
    </PageShell>
  );
}
