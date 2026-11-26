import { APP_NAME } from "@/config/app";
import { getPublicBranding } from "@/services/platform-settings.service";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BarChart3, Boxes, ShieldCheck } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  /** Name shown beside the logo: the store on a tenant login, otherwise the platform name. */
  brandName?: string;
  /** Small label and headline on the side panel; they default to the sign-in wording. */
  eyebrow?: string;
  headline?: string;
  /** A wider card for longer forms (sign-up), so the fields sit side by side and the page does not need to scroll. */
  wide?: boolean;
};

// Auth screens use the landing page's fixed light palette (Kanova orange + purple on white), whatever the app theme is.
const LANDING_THEME = {
  colorScheme: "light",
  "--background": "#ffffff",
  "--foreground": "#080a25",
  "--card": "#ffffff",
  "--card-foreground": "#080a25",
  // Orange buttons carry navy text: white on this orange is only about 2.9:1.
  "--primary": "#f86f18",
  "--primary-hover": "#fa9c2c",
  "--primary-foreground": "#080a25",
  "--link": "#581cc6",
  "--muted": "#fff8f2",
  "--muted-foreground": "#4b4e68",
  "--border": "#f0e4d8",
  "--input": "#e3d6c8",
  "--ring": "#581cc6",
} as React.CSSProperties;

const HIGHLIGHTS = [
  { icon: Boxes, text: "Products, orders and inventory in one place" },
  { icon: BarChart3, text: "Clear insights to grow your business" },
  { icon: ShieldCheck, text: "Secure, role-based access for your team" },
];

export async function AuthShell({ title, description, children, footer, icon, brandName, eyebrow = "WELCOME BACK", headline = "Your store deserves a smarter way to grow.", wide = false }: Props) {
  const branding = await getPublicBranding();
  const platformName = brandName ?? APP_NAME;
  // The platform logo belongs to the platform, not to a store: a store login keeps the built-in mark.
  const logoUrl = brandName ? null : branding.logoUrl;
  return (
    <div style={LANDING_THEME} className="lp-root grid min-h-dvh bg-lp-bg text-lp-heading lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate hidden overflow-hidden bg-lp-deep p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between xl:p-16">
        <span aria-hidden className="pointer-events-none absolute -top-40 -right-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(248,111,24,0.34),transparent_65%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-56 -left-32 -z-10 size-[34rem] rounded-full border border-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-40 -left-14 -z-10 size-[34rem] rounded-full border border-lp-accent/25" />
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(160deg,#2c1275_0%,#080a25_70%)]" />

        <Link href="/" className="inline-flex items-center gap-2.5 self-start rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lp-accent">
          {logoUrl ? (
            <Image src={logoUrl} alt="" aria-hidden width={160} height={48} unoptimized className="h-9 w-auto max-w-40 shrink-0 object-contain" />
          ) : (
            <Image src="/kanova-mark.png" alt="" aria-hidden width={230} height={279} className="h-9 w-auto shrink-0" priority />
          )}
          <span className="lp-display text-xl leading-none font-extrabold tracking-tight">{platformName}</span>
        </Link>

        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-[0.14em] text-lp-accent-light">{eyebrow}</p>
          <h2 className="mt-4 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance xl:text-5xl">{headline}</h2>
          <span aria-hidden className="lp-gold-rule mt-6 block h-px w-24" />
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-white/80">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-lp-accent/30 bg-white/5 text-lp-accent-light">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-white/50">Everything your e-commerce business needs, organized in one place.</p>
      </aside>

      <main className="lp-paper relative flex flex-col items-center justify-center px-4 py-8 sm:px-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lp-primary lg:hidden">
          <Image src="/kanova-mark.png" alt="" aria-hidden width={230} height={279} className="h-8 w-auto shrink-0" priority />
          <span className="lp-display text-xl leading-none font-extrabold tracking-tight">{platformName}</span>
        </Link>

        <div
          className={`w-full rounded-3xl border border-lp-border bg-lp-card p-6 shadow-[0_30px_60px_-30px_rgba(53,13,139,0.35)] sm:p-8 ${wide ? "max-w-lg" : "max-w-sm sm:p-8"}`}
        >
          {icon ? <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-lp-secondary text-lp-primary">{icon}</div> : null}
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-6 text-lp-text">{description}</p> : null}
          <span aria-hidden className="lp-gold-rule mt-4 mb-5 block h-px w-16" />
          <div className="space-y-4">{children}</div>
        </div>

        {footer ? <div className="mt-5 max-w-md text-center text-sm text-lp-text">{footer}</div> : null}
        <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-sm text-lp-text underline-offset-4 outline-none hover:text-lp-primary hover:underline focus-visible:ring-2 focus-visible:ring-lp-primary">
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to home
        </Link>
      </main>
    </div>
  );
}
