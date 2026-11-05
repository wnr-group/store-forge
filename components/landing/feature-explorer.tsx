"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { BarChart3, Boxes, Check, Palette, ShoppingBag, Store, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";

type Feature = {
  icon: LucideIcon;
  title: string;
  lead: string;
  points: string[];
  photo: { src: string; alt: string; width: number; height: number; position?: string };
};

const FEATURES: Feature[] = [
  {
    icon: Store,
    title: "Easy Store Management",
    lead: "Run your whole store from one simple place.",
    points: ["Set up your store name, logo and details once", "Invite your team and choose what each person can do", "Open your store on its own web address"],
    photo: { src: "/landing/feat-team.webp", alt: "A shop owner briefing two colleagues at the counter of a cosy store, with brass pendant lamps and shelves of textiles and ceramics behind them", width: 1672, height: 941, position: "48% 40%" },
  },
  {
    icon: Boxes,
    title: "Product and Inventory Management",
    lead: "Keep every product organised and well stocked.",
    points: ["Add products with photos, variants and prices", "Group them into categories and collections", "Spot low stock before it becomes a problem"],
    photo: { src: "/landing/feat-stockroom.webp", alt: "A man in an apron carefully lifting a folded navy sweater from neatly stacked knitwear on steel shelving in a stockroom", width: 1672, height: 941, position: "42% 50%" },
  },
  {
    icon: ShoppingBag,
    title: "Order Management",
    lead: "See every order and where it stands.",
    points: ["Recent orders and their status on your overview", "Know what is paid, pending or fulfilled", "Follow your sales as orders come in"],
    photo: { src: "/landing/feat-handover.webp", alt: "A shop owner in a navy apron handing a kraft-paper parcel tied with gold twine to a courier at the shop door", width: 1672, height: 941, position: "50% 40%" },
  },
  {
    icon: Users,
    title: "Customer Management",
    lead: "Know the people who buy from you.",
    points: ["A searchable list of every customer", "See how many orders they placed and what they spent", "Find a customer's details in one click"],
    photo: { src: "/landing/feat-counter.webp", alt: "A shop owner laughing with a customer who is holding up a cream knit scarf at the shop counter", width: 1536, height: 1024, position: "50% 40%" },
  },
  {
    icon: BarChart3,
    title: "Business Analytics",
    lead: "Understand what is working, and do more of it.",
    points: ["Sales and orders over 7, 30 or 90 days", "See your best-selling products at a glance", "Get a heads-up about products running low"],
    photo: { src: "/landing/feat-evening.webp", alt: "A woman seen from behind at a desk by a window, looking out over city lights at dusk, with a tablet, notebook and brass lamp", width: 1672, height: 941, position: "50% 50%" },
  },
  {
    icon: Palette,
    title: "Store Customization",
    lead: "Make your store look and feel like yours.",
    points: ["Add your logo and a description of your business", "Set your currency and timezone", "Show contact details customers can use"],
    photo: { src: "/landing/feat-swatches.webp", alt: "A designer comparing navy and linen fabric swatches against a mood board of colours and textures", width: 1536, height: 1024, position: "50% 50%" },
  },
];

/**
 * One feature is open at a time. The open feature's description sits in the list; its photograph is shown beside it
 * (beneath it on small screens). Buttons use aria-expanded/aria-controls, and the arrow keys move between them.
 */
export function FeatureExplorer() {
  const [open, setOpen] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = FEATURES.length - 1;
    const next = e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    buttons.current[next]?.focus();
    setOpen(next);
  };

  return (
    <Reveal className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <ul className="divide-y divide-white/10 border-y border-white/10">
        {FEATURES.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.title} className={cn("relative transition-colors duration-300", isOpen && "bg-white/[0.04]")}>
              <span className={cn("absolute inset-y-0 left-0 w-0.5 bg-lp-accent transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")} aria-hidden />
              <h3>
                <button
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  id={`feature-btn-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`feature-panel-${i}`}
                  onClick={() => setOpen(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className="flex w-full items-center gap-4 px-5 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-lp-accent focus-visible:ring-inset sm:px-6"
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300", isOpen ? "bg-lp-accent text-lp-heading" : "bg-white/10 text-white/80")}>
                    <f.icon className="size-5" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className={cn("flex-1 text-lg font-semibold tracking-tight transition-colors duration-300", isOpen ? "text-white" : "text-white/70 hover:text-white")}>{f.title}</span>
                  <span className={cn("text-sm font-medium tabular-nums transition-colors", isOpen ? "text-lp-accent" : "text-white/40")} aria-hidden>
                    0{i + 1}
                  </span>
                </button>
              </h3>

              <div
                id={`feature-panel-${i}`}
                role="region"
                aria-labelledby={`feature-btn-${i}`}
                className={cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-6 sm:px-6 sm:pl-[5.25rem]">
                    <p className="text-base leading-7 text-white/85">{f.lead}</p>
                    <ul className="mt-4 space-y-2.5">
                      {f.points.map((p) => (
                        <li key={p} className="flex gap-3 text-sm leading-6 text-white/75">
                          <Check className="mt-0.5 size-4 shrink-0 text-lp-accent" strokeWidth={2.25} aria-hidden />
                          {p}
                        </li>
                      ))}
                    </ul>
                    {/* Small screens: the photograph sits inside the open item. */}
                    <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-xl border border-white/10 lg:hidden">
                      <Image src={f.photo.src} alt={f.photo.alt} fill sizes="(min-width: 640px) 560px, 100vw" style={{ objectPosition: f.photo.position }} className="object-cover" />
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Large screens: the photographs crossfade as the open feature changes. */}
      <div className="hidden lg:sticky lg:top-24 lg:block">
        <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-white/10 bg-lp-primary shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]">
          {FEATURES.map((f, i) => (
            <Image
              key={f.photo.src}
              src={f.photo.src}
              alt={i === open ? f.photo.alt : ""}
              fill
              sizes="(min-width: 1024px) 640px, 0px"
              style={{ objectPosition: f.photo.position }}
              className={cn("object-cover transition-opacity duration-700 ease-in-out motion-reduce:transition-none", i === open ? "opacity-100" : "opacity-0")}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1d2e]/85 to-transparent p-6 pt-20">
            <p className="text-sm font-medium text-lp-accent">0{open + 1} / 0{FEATURES.length}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-white">{FEATURES[open].title}</p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
