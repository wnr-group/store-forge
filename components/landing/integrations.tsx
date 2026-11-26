import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTEGRATION_ICONS, type IntegrationIcon } from "./integration-icons";
import { IntegrationsDiagram } from "./integrations-diagram";
import { SlideIn } from "./effects";
import { Container, Section } from "./ui";

type Status = "available" | "coming-soon" | "planned";
type Provider = { name: string; /** Only with a verified, shipped integration. */ logo?: string };

type Integration = {
  id: string;
  label: string;
  title: string;
  text: string;
  icon: IntegrationIcon;
  /** Record-keeping only (not shown on the page). Never "available" until the integration is built and verified. */
  status: Status;
  /** Leave empty until a provider is genuinely supported; the card then shows no provider row. */
  providers: Provider[];
};

/**
 * Centralised integration data. Nothing in the codebase integrates any third-party service yet, so every category is
 * "planned" with no providers. Provider names from the brief are deliberately not listed: naming them here would read
 * as a commitment. Add them to `providers` (with `status` updated) only once each one is shipped.
 */
const INTEGRATIONS: Integration[] = [
  { id: "payments", label: "Payments", title: "Payment Gateways", text: "Help businesses accept and manage online payments through supported payment providers.", icon: "payments", status: "planned", providers: [] },
  { id: "shipping", label: "Shipping", title: "Shipping & Logistics", text: "Connect shipping and delivery services to simplify order fulfillment and tracking.", icon: "shipping", status: "planned", providers: [] },
  { id: "marketing", label: "Marketing", title: "Marketing & Communication", text: "Connect tools that help businesses communicate with customers and manage marketing activities.", icon: "marketing", status: "planned", providers: [] },
  { id: "analytics", label: "Analytics", title: "Analytics & Tracking", text: "Understand business performance through analytics and tracking services.", icon: "analytics", status: "planned", providers: [] },
  { id: "accounting", label: "Accounting", title: "Accounting & Finance", text: "Organize financial operations through accounting and business management tools.", icon: "accounting", status: "planned", providers: [] },
];

const BENEFITS = ["Connect essential business tools", "Simplify everyday workflows", "Build a flexible business ecosystem"] as const;

function CategoryCard({ item, index, className }: { item: Integration; index: number; className?: string }) {
  const Icon = INTEGRATION_ICONS[item.icon];
  return (
    <SlideIn as="li" x={56} delay={(index % 3) * 0.1} amount={0.15} className={cn("group", className)}>
      <article className="relative isolate flex h-full transform-gpu flex-col rounded-2xl border border-lp-border bg-white p-6 transition-[translate,border-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:-translate-y-1.5 group-hover:border-lp-primary/30 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {/* Shadow fades in on its own layer; animating box-shadow directly repaints every frame and looks choppy */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 shadow-[0_24px_48px_-24px_rgba(8,10,37,0.3)] transition-opacity duration-700 ease-out group-hover:opacity-100 motion-reduce:transition-none" />
        <span className="grid size-11 place-items-center rounded-xl border border-lp-border bg-lp-bg text-lp-primary">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="mt-5 text-xs font-medium text-lp-text/60 tabular-nums">{String(index + 1).padStart(2, "0")}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-lp-heading">{item.title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-lp-text">{item.text}</p>
        {item.providers.length ? (
          <ul className="mt-auto flex flex-wrap gap-2 pt-5">
            {item.providers.map((p) => (
              <li key={p.name} className="rounded-md border border-lp-border bg-lp-bg px-2.5 py-1 text-xs font-medium text-lp-heading">
                {p.name}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </SlideIn>
  );
}

export function Integrations() {
  return (
    <Section id="integrations" className="lp-paper bg-lp-bg py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[5fr_6fr] lg:gap-16">
          <SlideIn x={-48}>
            <p className="text-sm font-medium tracking-wide text-lp-primary">CONNECTED BUSINESS. SIMPLIFIED OPERATIONS.</p>
            <h2 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-lp-heading sm:text-[2.6rem]">Everything works better when it&apos;s connected.</h2>
            <span aria-hidden className="mt-6 block h-0.5 w-14 bg-lp-primary" />
            <p className="mt-6 max-w-md text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
              Bring your essential business tools and services together. Build a connected e-commerce ecosystem that helps simplify operations and keeps your business moving forward.
            </p>
            <ul className="mt-8 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-3 text-[15px] font-medium text-lp-heading">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lp-primary/10 text-lp-primary">
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-lp-text">One platform. A connected ecosystem. More possibilities.</p>
            <a
              href="#integration-categories"
              className="group mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lp-primary outline-none transition-colors duration-300 hover:text-lp-primary-hover focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
            >
              Explore Integrations
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
            </a>
          </SlideIn>
          <IntegrationsDiagram nodes={INTEGRATIONS.map(({ id, label, icon }) => ({ id, label, icon }))} />
        </div>

        <ul id="integration-categories" className="mt-20 grid scroll-mt-24 gap-4 sm:grid-cols-2 lg:mt-28 lg:grid-cols-6">
          {INTEGRATIONS.map((item, i) => (
            <CategoryCard key={item.id} item={item} index={i} className={i < 3 ? "lg:col-span-2" : "lg:col-span-3"} />
          ))}
        </ul>
      </Container>
    </Section>
  );
}
