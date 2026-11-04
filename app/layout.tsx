import type { Metadata } from "next";
import { Geist_Mono, Inter, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Inter: body, navigation, forms, tables. Manrope: page titles and section headings.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "StoreForge - launch your online store", template: "%s | StoreForge" },
  description: "StoreForge lets merchants create and run their own online store on a secure, multi-tenant platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
