import { BarChart3, LayoutDashboard, Package, ShoppingCart, Users, Warehouse, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { Container, Section } from "./ui";

/* Small UI sketches. They are decorative (aria-hidden) and use sample labels only. */

const Bar = ({ className }: { className?: string }) => <span className={cn("block h-1.5 rounded-full bg-lp-border", className)} />;

const TAG = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15",
} as const;
const Tag = ({ tone, children }: { tone: keyof typeof TAG; children: React.ReactNode }) => (
  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", TAG[tone])}>{children}</span>
);

function DashboardPreview() {
  return (
    <div className="flex h-full gap-2.5">
      <div className="flex w-9 flex-col gap-2 rounded-md bg-white p-2 ring-1 ring-lp-border">
        <span className="size-5 rounded bg-lp-primary" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 rounded-full bg-lp-border" />
        ))}
      </div>
      <div className="flex-1 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Orders", "128"],
            ["Products", "246"],
            ["Customers", "1.2k"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-white p-2 ring-1 ring-lp-border">
              <p className="text-[9px] text-lp-text">{k}</p>
              <p className="text-sm font-semibold text-lp-heading">{v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 rounded-md bg-white p-2.5 ring-1 ring-lp-border">
          <Bar className="w-2/3" />
          <Bar className="w-full" />
          <Bar className="w-1/2" />
        </div>
      </div>
    </div>
  );
}

function ProductPreview() {
  const rows = [
    ["Linen shirt", "$48.00", "bg-amber-100"],
    ["Canvas tote", "$22.00", "bg-sky-100"],
    ["Ceramic mug", "$16.50", "bg-rose-100"],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([n, p, c]) => (
        <div key={n} className="flex items-center gap-3 rounded-md bg-white p-2 ring-1 ring-lp-border">
          <span className={cn("size-8 rounded", c)} />
          <span className="flex-1 text-xs font-medium text-lp-heading">{n}</span>
          <span className="text-xs text-lp-text tabular-nums">{p}</span>
        </div>
      ))}
    </div>
  );
}

function OrderPreview() {
  const rows: [string, string, keyof typeof TAG][] = [
    ["#1042", "Paid", "green"],
    ["#1041", "Processing", "amber"],
    ["#1040", "Shipped", "blue"],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([id, s, tone]) => (
        <div key={id} className="flex items-center justify-between rounded-md bg-white px-3 py-2.5 ring-1 ring-lp-border">
          <span className="text-xs font-medium text-lp-heading tabular-nums">Order {id}</span>
          <Tag tone={tone}>{s}</Tag>
        </div>
      ))}
    </div>
  );
}

function InventoryPreview() {
  const rows: [string, number, string, keyof typeof TAG][] = [
    ["Linen shirt", 82, "In stock", "green"],
    ["Canvas tote", 24, "Low", "amber"],
    ["Ceramic mug", 4, "Reorder", "red"],
  ];
  const bar = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500", blue: "bg-sky-500" } as const;
  return (
    <div className="space-y-2">
      {rows.map(([n, pct, label, tone]) => (
        <div key={n} className="rounded-md bg-white px-3 py-2 ring-1 ring-lp-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-lp-heading">{n}</span>
            <Tag tone={tone}>{label}</Tag>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-lp-soft">
            <span className={cn("block h-full rounded-full", bar[tone])} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerPreview() {
  const rows = [
    ["AK", "Returning customer", "6 orders"],
    ["MR", "New customer", "1 order"],
    ["SD", "Returning customer", "3 orders"],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([i, t, o]) => (
        <div key={i} className="flex items-center gap-3 rounded-md bg-white p-2 ring-1 ring-lp-border">
          <span className="grid size-8 place-items-center rounded-full bg-lp-soft text-[10px] font-semibold text-lp-primary">{i}</span>
          <span className="flex-1 text-xs text-lp-text">{t}</span>
          <span className="text-[11px] font-medium text-lp-heading">{o}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPreview() {
  const h = [38, 52, 44, 66, 58, 80, 72];
  return (
    <div className="flex h-full flex-col rounded-md bg-white p-3 ring-1 ring-lp-border">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] text-lp-text">Revenue</p>
        <Tag tone="green">+12%</Tag>
      </div>
      <div className="mt-2 flex flex-1 items-end gap-1.5">
        {h.map((v, i) => (
          <span key={i} className={cn("flex-1 rounded-t", i === h.length - 1 ? "bg-lp-primary" : "bg-lp-primary/20")} style={{ height: `${v}%` }} />
        ))}
      </div>
    </div>
  );
}

const FEATURES: { icon: LucideIcon; title: string; text: string; visual: React.ReactNode }[] = [
  { icon: LayoutDashboard, title: "Centralized Store Management", text: "Run your whole business from one dashboard. Products, orders, customers and daily operations stay organized without switching between tools.", visual: <DashboardPreview /> },
  { icon: Package, title: "Effortless Product Management", text: "Add, update and organize your catalog with ease. Keep product details, pricing, inventory and images accurate in one place.", visual: <ProductPreview /> },
  { icon: ShoppingCart, title: "Smart Order Management", text: "Follow every order from placement to fulfillment. Manage statuses, payments and deliveries while your operations stay in order.", visual: <OrderPreview /> },
  { icon: Warehouse, title: "Real-Time Inventory Tracking", text: "See stock levels and availability as they change. Reduce overselling, avoid shortages and keep tighter control of your inventory.", visual: <InventoryPreview /> },
  { icon: Users, title: "Customer Management", text: "Keep customer details and purchase history together. Understand activity and build the relationships that bring shoppers back.", visual: <CustomerPreview /> },
  { icon: BarChart3, title: "Business Analytics & Insights", text: "Get a clear view of sales, revenue, orders and performance, then use the insights to make smarter decisions.", visual: <AnalyticsPreview /> },
];

export function Features() {
  return (
    <Section id="features" className="bg-white">
      <Container>
        <div className="max-w-2xl">
          <Reveal as="p" y={14} className="text-sm font-medium tracking-wide text-lp-primary">WHAT YOU CAN DO WITH STOREFORGE</Reveal>
          <Reveal y={20} delay={0.08}>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-lp-heading sm:text-4xl sm:leading-[1.15]">Everything your store needs. All in one place.</h2>
          </Reveal>
          <Reveal as="p" y={20} delay={0.16} className="mt-4 text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
            From managing products and orders to tracking inventory and understanding performance, StoreForge gives you the tools to run your e-commerce business with confidence.
          </Reveal>
        </div>
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.title} delay={(i % 3) * 0.12} y={32} amount={0.12} className="group h-full">
              <article className="relative isolate flex h-full transform-gpu flex-col rounded-2xl border border-lp-border bg-lp-bg p-3 transition-[translate,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:border-lp-primary/25 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                {/* The shadow fades in on its own layer: animating box-shadow directly repaints every frame and looks choppy */}
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 shadow-[0_20px_44px_-18px_rgba(23,43,66,0.28)] transition-opacity duration-500 ease-out group-hover:opacity-100 motion-reduce:transition-none" />
                <div aria-hidden className="h-48 overflow-hidden rounded-xl bg-lp-soft p-3.5">
                  {f.visual}
                </div>
                <div className="flex flex-1 flex-col px-3 pt-5 pb-3">
                  <span className="grid size-10 place-items-center rounded-lg border border-lp-border bg-white text-lp-primary shadow-[0_1px_2px_rgba(23,43,66,0.05)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-3 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none">
                    <f.icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-lp-heading">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-6 text-lp-text">{f.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
