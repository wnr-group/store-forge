import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { ThemedToaster } from "@/components/shared/themed-toaster";
import { THEME_INIT_SCRIPT } from "@/lib/theme/script";
import { getPublicBranding } from "@/services/platform-settings.service";
import "./globals.css";

// Self-hosted variable fonts (latin subset, app/fonts): no Google Fonts request at dev, build or run time, so the
// app also works offline and Turbopack's dev font loader is not involved.
// Inter: the one UI family (body, headings, forms, tables). Geist Mono: figures, slugs and other meta.
const inter = localFont({ src: "./fonts/inter-latin.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "./fonts/geist-mono-latin.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });
// Public landing page only: Manrope for display headings, DM Sans for body copy (see .lp-root in globals.css).
const manrope = localFont({ src: "./fonts/manrope-latin.woff2", variable: "--font-manrope", weight: "200 800", display: "swap" });
const dmSans = localFont({ src: "./fonts/dm-sans-latin.woff2", variable: "--font-dm-sans", weight: "100 1000", display: "swap" });

// Storefront theme fonts (Karthika): Cormorant Garamond for display, Jost for body. Registered in lib/templates/engine/fonts.ts.
const jost = localFont({ src: "./fonts/jost-latin.woff2", variable: "--font-jost", weight: "100 900", display: "swap" });
const cormorantGaramond = localFont({ src: "./fonts/cormorant-garamond-latin.woff2", variable: "--font-cormorant-garamond", weight: "300 700", display: "swap" });

// Storefront theme fonts (Stride): Archivo for headlines, Plus Jakarta Sans for body. Registered in lib/templates/engine/fonts.ts.
const plusJakartaSans = localFont({ src: "./fonts/plus-jakarta-sans-latin.woff2", variable: "--font-plus-jakarta-sans", weight: "200 800", display: "swap" });
const archivo = localFont({ src: "./fonts/archivo-latin.woff2", variable: "--font-archivo", weight: "100 900", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await getPublicBranding();
  return {
    title: { default: `${platformName} - launch your online store`, template: `%s | ${platformName}` },
    description: `${platformName} lets merchants create and run their own online store on a secure, multi-tenant platform.`,
    applicationName: platformName,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme-init script below sets the `dark` class before React hydrates.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} ${manrope.variable} ${dmSans.variable} ${jost.variable} ${cormorantGaramond.variable} ${plusJakartaSans.variable} ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* beforeInteractive: Next injects it into the initial HTML and runs it before hydration, without React re-rendering a <script>. */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
