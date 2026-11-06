import type { Metadata } from "next";
import { FinalCta } from "@/components/landing/final-cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import { MotionProvider, ScrollProgress } from "@/components/landing/motion";
import { Industries } from "@/components/landing/industries";
import { ProblemSolution } from "@/components/landing/problem-solution";
import { AnnouncementBar, SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

export const metadata: Metadata = {
  title: { absolute: "StoreForge - build, manage and grow your online store" },
  description: "StoreForge helps you create your online store, manage products, orders and customers, and give shoppers a better way to buy.",
};

/** Public landing page. Every link points at an existing route or an anchor on this page. */
export default function LandingPage() {
  return (
    <MotionProvider>
      <div id="top" className="min-h-dvh bg-lp-bg font-sans text-lp-heading antialiased">
        {/* Without JavaScript nothing can animate in, so keep every revealed element visible */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <ScrollProgress />
        <AnnouncementBar />
        <SiteHeader />
        <main>
          <HeroCarousel />
          <Features />
          <ProblemSolution />
          <Industries />
          <Faq />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
