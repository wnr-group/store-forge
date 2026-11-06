import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, LogIn, MessagesSquare, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/app";
import { Fade } from "@/components/landing/effects";
import { PageHero, PageShell } from "@/components/landing/page-shell";
import { Container, Section } from "@/components/landing/ui";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the StoreForge team, or sign in to your workspace.",
};

const CHANNELS: { icon: LucideIcon; title: string; text: string; label: string; href: string; external?: boolean }[] = [
  {
    icon: Building2,
    title: "Talk to WNR Group",
    text: "StoreForge is powered by WNR Group. Reach out through their website for questions about the platform, partnerships or getting started.",
    label: "Visit wnradvisory.com",
    href: "https://www.wnradvisory.com/",
    external: true,
  },
  {
    icon: LogIn,
    title: "Already a customer?",
    text: "Sign in to your workspace to manage products, orders and customers, or to reach your team's own admin.",
    label: "Sign in",
    href: ROUTES.login,
  },
  {
    icon: MessagesSquare,
    title: "Browse common questions",
    text: "Many questions about how StoreForge works are answered in the FAQ on our home page.",
    label: "Read the FAQ",
    href: "/#faq",
  },
];

const CARD_LINK = "mt-6 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-lp-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2";
const CARD_ICON = "size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none";

export default function ContactPage() {
  return (
    <PageShell>
      <PageHero eyebrow="Contact" title="Let's talk about your store.">
        Questions about StoreForge, or ready to get started? Choose the way that suits you best.
      </PageHero>

      <Section className="lp-paper bg-lp-bg">
        <Container>
          <ul className="grid gap-5 lg:grid-cols-3">
            {CHANNELS.map((c, i) => (
              <li key={c.title}>
                <Fade delay={i * 0.1} className="h-full">
                  <article className="group flex h-full flex-col rounded-2xl border border-lp-border bg-white p-7 transition-[translate,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-lp-primary/30 hover:shadow-[0_24px_48px_-24px_rgba(18,40,31,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className="grid size-11 place-items-center rounded-xl bg-lp-secondary text-lp-primary">
                      <c.icon className="size-5" aria-hidden />
                    </span>
                    <h2 className="mt-5 text-lg font-bold text-lp-heading">{c.title}</h2>
                    <p className="mt-2 flex-1 text-base leading-7 text-lp-text">{c.text}</p>
                    {c.external ? (
                      <a href={c.href} target="_blank" rel="noopener noreferrer" className={CARD_LINK}>
                        {c.label}
                        <ArrowUpRight className={CARD_ICON} aria-hidden />
                      </a>
                    ) : (
                      <Link href={c.href} className={CARD_LINK}>
                        {c.label}
                        <ArrowUpRight className={CARD_ICON} aria-hidden />
                      </Link>
                    )}
                  </article>
                </Fade>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </PageShell>
  );
}
