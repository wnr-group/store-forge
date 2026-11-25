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
};

// Auth screens use the landing page's fixed light palette (deep green + gold on cream), whatever the app theme is.
const LANDING_THEME = {
  colorScheme: "light",
  "--background": "#f8f7f2",
  "--foreground": "#202a25",
  "--card": "#ffffff",
  "--card-foreground": "#202a25",
  "--primary": "#244c3c",
  "--primary-hover": "#1a3a2d",
  "--primary-foreground": "#ffffff",
  "--link": "#244c3c",
  "--muted": "#eff2ea",
  "--muted-foreground": "#5a6860",
  "--border": "#e3e2d8",
  "--input": "#d9d8cc",
  "--ring": "#244c3c",
} as React.CSSProperties;

const HIGHLIGHTS = [
  { icon: Boxes, text: "Products, orders and inventory in one place" },
  { icon: BarChart3, text: "Clear insights to grow your business" },
  { icon: ShieldCheck, text: "Secure, role-based access for your team" },
];

export async function AuthShell({ title, description, children, footer, icon, brandName }: Props) {
  const branding = await getPublicBranding();
  const platformName = brandName ?? APP_NAME;
  // The platform logo belongs to the platform, not to a store: a store login keeps the built-in mark.
  const logoUrl = brandName ? null : branding.logoUrl;
  return (
    <div style={LANDING_THEME} className="lp-root grid min-h-dvh bg-lp-bg text-lp-heading lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate hidden overflow-hidden bg-lp-deep p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <span aria-hidden className="pointer-events-none absolute -top-40 -right-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(199,167,122,0.32),transparent_65%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-56 -left-32 -z-10 size-[34rem] rounded-full border border-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-40 -left-14 -z-10 size-[34rem] rounded-full border border-lp-accent/25" />
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(160deg,#244c3c_0%,#12281f_70%)]" />

        <Link href="/" className="inline-flex items-center gap-2.5 self-start rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lp-accent">
          {logoUrl ? (
            <Image src={logoUrl} alt="" aria-hidden width={160} height={48} unoptimized className="h-9 w-auto max-w-40 shrink-0 object-contain" />
          ) : (
            <Image src="/kanova-mark.png" alt="" aria-hidden width={230} height={279} className="h-9 w-auto shrink-0" priority />
          )}
          <span className="lp-display text-xl leading-none font-extrabold tracking-tight">{platformName}</span>
        </Link>

        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-[0.14em] text-lp-accent-light">WELCOME BACK</p>
          <h2 className="mt-4 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance xl:text-5xl">Your store deserves a smarter way to grow.</h2>
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

      <main className="lp-paper relative flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lp-primary lg:hidden">
          <Image src="/kanova-mark.png" alt="" aria-hidden width={230} height={279} className="h-8 w-auto shrink-0" priority />
          <span className="lp-display text-xl leading-none font-extrabold tracking-tight">{platformName}</span>
        </Link>

        <div className="w-full max-w-md rounded-3xl border border-lp-border bg-lp-card p-7 shadow-[0_30px_60px_-30px_rgba(18,40,31,0.35)] sm:p-10">
          {icon ? <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-lp-secondary text-lp-primary">{icon}</div> : null}
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-6 text-lp-text">{description}</p> : null}
          <span aria-hidden className="lp-gold-rule mt-5 mb-6 block h-px w-16" />
          <div className="space-y-4">{children}</div>
        </div>

        {footer ? <div className="mt-6 max-w-md text-center text-sm text-lp-text">{footer}</div> : null}
        <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-sm text-lp-text underline-offset-4 outline-none hover:text-lp-primary hover:underline focus-visible:ring-2 focus-visible:ring-lp-primary">
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to home
        </Link>
      </main>
    </div>
  );
}
