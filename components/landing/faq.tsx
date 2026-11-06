import { ArrowRight } from "lucide-react";
import { FaqAccordion, type FaqItem } from "./faq-accordion";
import { SlideIn } from "./effects";
import { Container, Section } from "./ui";

// TODO: point this at the real support channel (email or contact page) once one exists.
const SUPPORT_HREF = "#";

const FAQS: FaqItem[] = [
  { q: "What is StoreForge?", a: "StoreForge is a SaaS platform designed to help e-commerce businesses organize and manage essential store operations, including products, orders, inventory, customers and business insights." },
  { q: "Who can use StoreForge?", a: "StoreForge is designed for e-commerce business owners, growing online brands, retailers and teams looking for a more organized way to manage their store operations." },
  { q: "How do I get started with StoreForge?", a: "Create your account, set up your business workspace, and start organizing your products, inventory and orders through your dashboard." },
  { q: "Can I manage all my products in one place?", a: "Yes. StoreForge helps you organize your product catalog, update product details, manage pricing and monitor product availability from one centralized workspace." },
  { q: "Can I track and manage customer orders?", a: "Yes. You can manage incoming orders, monitor their statuses and keep your order operations organized through your dashboard." },
  { q: "Does StoreForge provide business analytics?", a: "StoreForge provides business performance insights to help you understand important store activities, including sales and order performance." },
  { q: "Is StoreForge suitable for small businesses?", a: "Absolutely. StoreForge is designed to help businesses organize their e-commerce operations, whether they are just starting out or managing a growing online store." },
  { q: "Do I need technical knowledge to use StoreForge?", a: "No advanced technical knowledge should be required for everyday store management. StoreForge aims to provide a straightforward and accessible experience." },
];

export function Faq() {
  return (
    <Section id="faq" className="bg-lp-bg">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SlideIn x={-48}>
              <p className="text-sm font-medium tracking-wide text-lp-primary">GOT QUESTIONS?</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-lp-heading sm:text-5xl sm:leading-[1.08]">Everything you need to know.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
                Have questions about managing your store with StoreForge? Find answers to common questions about getting started, managing your business and making the most of the platform.
              </p>
            </SlideIn>
            <SlideIn x={-48} delay={0.15} className="mt-10 max-w-md border-l-2 border-lp-primary pl-5">
              <p className="text-base font-semibold text-lp-heading">Still have questions?</p>
              <p className="mt-1.5 text-[15px] leading-6 text-lp-text">We&apos;re here to help you get the most out of StoreForge.</p>
              <a
                href={SUPPORT_HREF}
                className="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lp-primary outline-none transition-colors duration-300 hover:text-lp-primary-hover focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                Contact Support
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
              </a>
            </SlideIn>
          </div>
          <FaqAccordion items={FAQS} />
        </div>
      </Container>
    </Section>
  );
}
