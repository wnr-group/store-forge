import { ArrowDown, ArrowRight, BarChart3, Check, EyeOff, Layers, LayoutDashboard, PackageX, Shuffle, Warehouse, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fade, MaskRise, ScaleIn, SlideIn } from "./effects";
import { Container, Section } from "./ui";

const PROBLEMS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Layers, title: "Too Many Tools", text: "Products, orders, customers and inventory spread across different platforms wastes valuable time." },
  { icon: PackageX, title: "Inventory Confusion", text: "Outdated stock information leads to overselling, missed sales and avoidable problems." },
  { icon: Shuffle, title: "Scattered Order Management", text: "Tracking orders, payments and fulfillment by hand makes every day harder to manage." },
  { icon: EyeOff, title: "No Clear Business Insights", text: "Without one view of sales and performance, confident decisions are hard to make." },
];

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: LayoutDashboard, title: "One Centralized Dashboard", text: "Everything important about your store in one place." },
  { icon: Zap, title: "Simplified Operations", text: "Manage products and orders with less manual work." },
  { icon: Warehouse, title: "Better Inventory Control", text: "Stay updated on stock levels and product availability." },
  { icon: BarChart3, title: "Clear Business Insights", text: "Understand your store's performance through meaningful analytics." },
];

/** Loose tool names, slightly tilted and dashed: the "disconnected" half of the story. */
const SCATTERED = [
  { label: "Spreadsheet", tilt: "-rotate-3" },
  { label: "Chat threads", tilt: "rotate-2" },
  { label: "Paper invoices", tilt: "-rotate-1" },
  { label: "Notes app", tilt: "rotate-3" },
] as const;

const TAG = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
} as const;

/** A miniature, decorative store dashboard. Sample labels only. */
function DashboardMock() {
  const orders: [string, string, keyof typeof TAG][] = [
    ["#1042", "Paid", "green"],
    ["#1041", "Processing", "amber"],
    ["#1040", "Shipped", "blue"],
  ];
  const bars = [34, 48, 42, 60, 54, 76, 68];
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border border-lp-border bg-lp-bg shadow-[0_12px_32px_-16px_rgba(23,43,66,0.25)]">
      <div className="flex items-center gap-1.5 border-b border-lp-border bg-white px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full bg-lp-border" />
        ))}
        <span className="ml-2 h-1.5 w-24 rounded-full bg-lp-soft" />
      </div>
      <div className="grid gap-3 p-3.5 sm:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Products", "246"],
              ["Orders", "128"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-lp-border bg-white p-2.5">
                <p className="text-[10px] text-lp-text">{k}</p>
                <p className="text-lg font-semibold tracking-tight text-lp-heading tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 rounded-lg border border-lp-border bg-white p-2.5">
            <p className="text-[10px] text-lp-text">Recent orders</p>
            {orders.map(([id, s, tone]) => (
              <div key={id} className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-lp-heading tabular-nums">{id}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", TAG[tone])}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-lp-border bg-white p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-lp-text">Sales</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", TAG.green)}>+12%</span>
            </div>
            <div className="mt-2 flex h-16 items-end gap-1.5">
              {bars.map((h, i) => (
                <span key={i} className={cn("flex-1 rounded-t", i === bars.length - 1 ? "bg-lp-primary" : "bg-lp-primary/20")} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-lp-border bg-white p-2.5">
            <p className="text-[10px] text-lp-text">Inventory</p>
            {[
              ["In stock", 82, "bg-emerald-500"],
              ["Low", 24, "bg-amber-500"],
            ].map(([k, w, c]) => (
              <div key={k as string}>
                <div className="flex justify-between text-[10px] text-lp-heading">
                  <span>{k}</span>
                  <span className="text-lp-text tabular-nums">{w}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-lp-soft">
                  <span className={cn("block h-full rounded-full", c as string)} style={{ width: `${w}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProblemSolution() {
  return (
    <Section id="solutions" className="bg-lp-bg">
      <Container>
        <div className="max-w-2xl">
          <Fade as="p" className="text-sm font-medium tracking-wide text-lp-primary">THE PROBLEM &amp; THE SOLUTION</Fade>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-lp-heading sm:text-4xl sm:leading-[1.15]">
            <MaskRise>Running an online store shouldn&apos;t feel like running five different businesses.</MaskRise>
          </h2>
          <Fade as="p" delay={0.3} className="mt-4 text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
            Managing products, tracking orders, monitoring inventory and understanding sales across disconnected tools creates unnecessary complexity. StoreForge brings everything together so you can focus on growing your business.
          </Fade>
        </div>

        <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] lg:gap-6">
          {/* Problem */}
          <SlideIn x={-72} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-lp-border bg-lp-soft p-5 sm:p-7">
              <p className="text-sm font-semibold text-lp-text">The challenges</p>
              <div aria-hidden className="mt-4 flex flex-wrap gap-2">
                {SCATTERED.map((s) => (
                  <span key={s.label} className={cn("rounded-md border border-dashed border-lp-text/40 bg-white/60 px-2.5 py-1 text-xs text-lp-text", s.tilt)}>
                    {s.label}
                  </span>
                ))}
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-3">
                {PROBLEMS.map((p) => (
                  <li key={p.title} className="group flex-1">
                    <div className="flex h-full items-center gap-4 rounded-xl border border-lp-border bg-white/70 p-4 transition-[translate,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:border-rose-300/70 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-600/10">
                        <p.icon className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div>
                        <h3 className="text-[15px] font-semibold text-lp-heading">{p.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-lp-text">{p.text}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </SlideIn>

          {/* Transition */}
          <ScaleIn scale={0.3} y={0} delay={0.45} className="flex items-center justify-center lg:flex-col">
            <span aria-hidden className="h-px w-12 bg-lp-border lg:h-12 lg:w-px" />
            <span className="mx-3 grid size-11 place-items-center rounded-full border border-lp-border bg-white text-lp-primary shadow-sm lg:mx-0 lg:my-3">
              <ArrowRight className="hidden size-5 lg:block" strokeWidth={1.75} aria-hidden />
              <ArrowDown className="size-5 lg:hidden" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">becomes</span>
            </span>
            <span aria-hidden className="h-px w-12 bg-lp-border lg:h-12 lg:w-px" />
          </ScaleIn>

          {/* Solution */}
          <SlideIn x={72} delay={0.1} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-lp-border bg-white p-5 shadow-[0_1px_2px_rgba(23,43,66,0.04)] sm:p-7">
              <p className="text-sm font-semibold text-lp-primary">The StoreForge solution</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-lp-heading sm:text-3xl">One platform. Complete control.</h3>
              <p className="mt-3 text-[15px] leading-7 text-lp-text">
                StoreForge brings your essential e-commerce operations into one organized workspace. Manage products, orders, inventory, customers and performance without unnecessary complexity.
              </p>
              <div className="mt-6">
                <DashboardMock />
              </div>
              <ul className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {BENEFITS.map((b) => (
                  <li key={b.title} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/15">
                      <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-lp-heading">{b.title}</h4>
                      <p className="mt-0.5 text-sm leading-5 text-lp-text">{b.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </SlideIn>
        </div>
      </Container>
    </Section>
  );
}
