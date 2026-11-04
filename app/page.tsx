import Link from "next/link";
import { ArrowRight, Globe, Layers, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";

const FEATURES = [
  {
    icon: Layers,
    title: "Your own workspace",
    text: "Every merchant gets an isolated workspace for their store, team and data.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    text: "Tenant isolation is enforced in the database itself, not just the UI.",
  },
  {
    icon: Globe,
    title: "Your store, your address",
    text: "Launch on a store subdomain today; custom domains are on the roadmap.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href={ROUTES.login} className={buttonVariants({ variant: "ghost" })}>
              Sign in
            </Link>
            <Link href={ROUTES.register} className={buttonVariants()}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/10 to-transparent"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:py-32">
            <p className="mb-4 inline-block rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              Multi-tenant commerce platform
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Launch your online store in minutes
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
              StoreForge gives every merchant a secure, dedicated workspace to build and run their business.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={ROUTES.register} className={buttonVariants({ size: "lg", className: "h-10 px-4" })}>
                Create your store <ArrowRight aria-hidden />
              </Link>
              <Link href={ROUTES.login} className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 px-4" })}>
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-card p-6">
              <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} StoreForge
      </footer>
    </div>
  );
}
