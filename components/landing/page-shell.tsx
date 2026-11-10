import { Fade } from "./effects";
import { MotionProvider, ScrollProgress } from "./motion";
import { AnnouncementBar, SiteFooter, SiteHeader } from "./site-chrome";
import { Container } from "./ui";

/** Frame shared by the public sub-pages (About, Contact): the landing header and footer around the page content. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div id="top" className="lp-root min-h-dvh bg-lp-bg text-lp-heading antialiased">
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important;clip-path:none!important}"}</style>
        </noscript>
        <ScrollProgress />
        <AnnouncementBar />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}

/** Deep green page banner with a gold eyebrow, shared by the sub-pages. */
export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-lp-primary">
      <span aria-hidden className="pointer-events-none absolute -top-48 -right-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(199,167,122,0.32),transparent_65%)]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-56 -left-28 -z-10 size-[30rem] rounded-full border border-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-40 -left-10 -z-10 size-[30rem] rounded-full border border-lp-accent/20" />
      <Container className="py-20 sm:py-28">
        <div className="max-w-2xl">
          <Fade as="p" className="inline-flex items-center gap-3 text-sm font-semibold tracking-wide text-lp-accent-light">
            <span aria-hidden className="lp-gold-rule h-px w-8" />
            {eyebrow}
          </Fade>
          <Fade delay={0.12}>
            <h1 className="mt-4 text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.5rem]">{title}</h1>
          </Fade>
          <Fade as="p" delay={0.24} className="mt-5 max-w-xl text-base leading-7 text-pretty text-white/75 sm:text-lg sm:leading-8">
            {children}
          </Fade>
        </div>
      </Container>
    </section>
  );
}
