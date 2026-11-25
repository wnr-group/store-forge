import { ArrowRight } from "lucide-react";
import { Fade, ScaleIn } from "./effects";
import { Container, Section, lpButton } from "./ui";

// TODO: point at the real sign-up or demo route once one exists. "#" keeps the button inert until then.
const GET_STARTED_HREF = "#";

export function FinalCta() {
  return (
    <Section id="get-started" className="bg-lp-bg">
      <Container>
        <ScaleIn scale={0.94} y={0} duration={1.2} amount={0.25} className="relative isolate overflow-hidden rounded-[2rem] bg-lp-primary px-6 py-16 text-center shadow-[0_40px_80px_-40px_rgba(8,10,37,0.6)] sm:px-12 sm:py-24">
          <span aria-hidden className="pointer-events-none absolute -top-40 -right-32 -z-10 size-[28rem] rounded-full bg-[radial-gradient(circle,rgba(250,156,44,0.35),transparent_65%)]" />
          <span aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 -z-10 size-[26rem] rounded-full border border-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-8 -z-10 size-[26rem] rounded-full border border-lp-accent/20" />
          <Fade as="p" delay={0.35} className="text-sm font-semibold tracking-[0.14em] text-lp-accent-light">
            READY TO SIMPLIFY YOUR BUSINESS?
          </Fade>
          <Fade delay={0.5}>
            <h2 className="mx-auto mt-4 max-w-2xl text-4xl leading-[1.1] font-extrabold tracking-tight text-balance text-white sm:text-5xl">Your store deserves a smarter way to grow.</h2>
          </Fade>
          <Fade as="p" delay={0.65} className="mx-auto mt-5 max-w-xl text-base leading-7 text-pretty text-white/75 sm:text-lg sm:leading-8">
            Bring your products, orders, inventory and business insights together with Kanova Store. Spend less time managing operations and more time building your business.
          </Fade>
          <Fade delay={0.8} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={GET_STARTED_HREF} className={lpButton("gold", "h-12 px-8 text-[15px] focus-visible:ring-offset-lp-primary")}>
              Get Started
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href="#features" className={lpButton("secondary", "h-12 border-white/30 bg-transparent px-8 text-[15px] text-white hover:bg-white/10 focus-visible:ring-offset-lp-primary")}>
              Explore Features
            </a>
          </Fade>
          <Fade as="p" delay={0.95} className="mt-8 text-sm text-white/60">
            Everything your e-commerce business needs, organized in one place.
          </Fade>
        </ScaleIn>
      </Container>
    </Section>
  );
}
