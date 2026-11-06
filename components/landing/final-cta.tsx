import { ArrowRight } from "lucide-react";
import { Fade, ScaleIn } from "./effects";
import { Container, Section, lpButton } from "./ui";

// TODO: point at the real sign-up or demo route once one exists. "#" keeps the button inert until then.
const GET_STARTED_HREF = "#";

export function FinalCta() {
  return (
    <Section id="get-started" className="bg-lp-bg">
      <Container>
        <ScaleIn scale={0.94} y={0} duration={1.2} amount={0.25} className="rounded-3xl bg-lp-primary px-6 py-16 text-center sm:px-12 sm:py-20">
          <Fade as="p" delay={0.35} className="text-sm font-medium tracking-wide text-lp-accent">
            READY TO SIMPLIFY YOUR BUSINESS?
          </Fade>
          <Fade delay={0.5}>
            <h2 className="mx-auto mt-4 max-w-2xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-white sm:text-5xl">Your store deserves a smarter way to grow.</h2>
          </Fade>
          <Fade as="p" delay={0.65} className="mx-auto mt-5 max-w-xl text-base leading-7 text-pretty text-white/75 sm:text-lg sm:leading-8">
            Bring your products, orders, inventory and business insights together with StoreForge. Spend less time managing operations and more time building your business.
          </Fade>
          <Fade delay={0.8} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={GET_STARTED_HREF} className={lpButton("light", "h-12 px-7 text-[15px] focus-visible:ring-offset-lp-primary")}>
              Get Started
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href="#features" className={lpButton("secondary", "h-12 border-white/30 bg-transparent px-7 text-[15px] text-white hover:bg-white/10 focus-visible:ring-offset-lp-primary")}>
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
