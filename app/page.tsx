import type { Metadata } from "next";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import { MotionProvider, ScrollProgress } from "@/components/landing/motion";
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
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
