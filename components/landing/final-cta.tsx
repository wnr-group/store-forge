import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { Container, lpButton } from "./ui";

// TODO: point at the real sign-up or demo route once one exists. "#" keeps the button inert until then.
const GET_STARTED_HREF = "#";

const TAG = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
} as const;

/** Decorative product preview with sample figures only; hidden from assistive tech. */
function DashboardPreview() {
  const orders: [string, string, keyof typeof TAG][] = [
    ["#1043", "Paid", "green"],
    ["#1042", "Processing", "amber"],
    ["#1041", "Shipped", "blue"],
  ];
  const bars = [30, 44, 38, 56, 50, 70, 62, 84];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[34rem]">
      <div className="lp-float rounded-2xl border border-white/15 bg-white p-4 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.55)] sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-lp-border" />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1.15fr_1fr]">
          <div className="rounded-xl border border-lp-border bg-lp-bg p-3.5">
            <p className="text-[11px] text-lp-text">Total sales</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-lp-heading tabular-nums">$24,860</p>
            <div className="mt-3 flex h-20 items-end gap-1.5">
              {bars.map((h, i) => (
                <span key={i} className={cn("flex-1 rounded-t", i === bars.length - 1 ? "bg-[#4263EB]" : "bg-[#4263EB]/20")} style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-lp-text">Revenue, last 8 weeks</p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-lp-border bg-lp-bg p-3.5">
              <p className="text-[11px] text-lp-text">Recent orders</p>
              <div className="mt-2 space-y-2">
                {orders.map(([id, s, tone]) => (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-lp-heading tabular-nums">{id}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", TAG[tone])}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-lp-border bg-lp-bg p-3.5">
              <p className="text-[11px] text-lp-text">Inventory</p>
              <div className="mt-2 space-y-2">
                {[
                  ["In stock", 82, "bg-emerald-500"],
                  ["Low", 24, "bg-amber-500"],
                ].map(([k, w, c]) => (
                  <div key={k as string}>
                    <div className="flex justify-between text-[10px] text-lp-heading">
                      <span>{k}</span>
                      <span className="text-lp-text tabular-nums">{w}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-lp-soft">
                      <span className={cn("lp-fill block h-full rounded-full", c as string)} style={{ width: `${w}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two small floating notes give depth without clutter */}
      <div className="lp-float-slow absolute -top-4 -right-2 flex items-center gap-2 rounded-lg border border-lp-border bg-white px-3 py-2 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.5)] sm:-right-6">
        <span className="grid size-5 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="size-3" strokeWidth={2.5} />
        </span>
        <span className="text-[11px] font-medium text-lp-heading">New order paid</span>
      </div>
      <div className="lp-float absolute -bottom-4 -left-2 flex items-center gap-2 rounded-lg border border-lp-border bg-white px-3 py-2 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.5)] sm:-left-6">
        <span className="grid size-5 place-items-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle className="size-3" strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-medium text-lp-heading">Low stock alert</span>
      </div>
    </div>
  );
}

export function FinalCta() {
  return (
    <section id="get-started" className="relative isolate scroll-mt-16 overflow-hidden bg-[#171C26] py-20 sm:py-28">
      {/* One restrained decoration: a faint grid that fades out toward the left */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_left,black,transparent_75%)]"
      />
      <Container>
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div>
            <Reveal as="p" y={14} className="text-sm font-medium tracking-[0.14em] text-[#7C93F5]">
              READY TO SIMPLIFY YOUR BUSINESS?
            </Reveal>
            <Reveal y={24} delay={0.08}>
              <h2 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">Your store deserves a smarter way to grow.</h2>
            </Reveal>
            <Reveal as="p" y={20} delay={0.16} className="mt-6 max-w-xl text-base leading-7 text-pretty text-[#AAB2C0] sm:text-lg sm:leading-8">
              Bring your products, orders, inventory and business insights together with StoreForge. Spend less time managing operations and more time building your business.
            </Reveal>
            <Reveal y={20} delay={0.24} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={GET_STARTED_HREF} className={lpButton("primary", "h-12 bg-[#4263EB] px-7 text-[15px] hover:bg-[#3454d1] focus-visible:ring-offset-[#171C26]")}>
                Get Started
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="#features" className={lpButton("secondary", "h-12 border-white/25 bg-transparent px-7 text-[15px] text-white hover:bg-white/10 focus-visible:ring-offset-[#171C26]")}>
                Explore Features
              </a>
            </Reveal>
            <Reveal as="p" y={12} delay={0.32} className="mt-6 text-sm text-[#AAB2C0]">
              Everything your e-commerce business needs, organized in one place.
            </Reveal>
          </div>
          <Reveal y={32} delay={0.2} from={0.97} className="px-3 sm:px-8 lg:px-0">
            <DashboardPreview />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
