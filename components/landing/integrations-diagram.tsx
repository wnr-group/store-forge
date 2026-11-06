"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { INTEGRATION_ICONS, type IntegrationIcon } from "./integration-icons";

export type DiagramNode = { id: string; label: string; icon: IntegrationIcon };

/** Five nodes on a ring around the hub, in percent of the square diagram (hub at 50, 50; ring radius 38). */
const POSITIONS = [
  [50, 12],
  [86.1, 38.3],
  [72.3, 80.7],
  [27.7, 80.7],
  [13.9, 38.3],
] as const;

/**
 * The hub-and-spoke picture. Hovering or focusing a node lights its connector and the node itself. Lines are drawn in
 * an SVG that shares the container's percent coordinate space, so the whole diagram scales with its width.
 */
export function IntegrationsDiagram({ nodes }: { nodes: readonly DiagramNode[] }) {
  const [hot, setHot] = useState<string | null>(null);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <circle cx="50" cy="50" r="38" fill="none" className="stroke-lp-border" strokeWidth="0.35" strokeDasharray="1 1.6" />
        {nodes.map((n, i) => {
          const [x, y] = POSITIONS[i];
          const on = hot === n.id;
          return (
            <g key={n.id}>
              <line x1="50" y1="50" x2={x} y2={y} className={cn("transition-[stroke] duration-300", on ? "stroke-lp-primary" : "stroke-lp-border")} strokeWidth={on ? 0.6 : 0.4} />
              <line x1="50" y1="50" x2={x} y2={y} className={cn("lp-flow transition-opacity duration-300", on ? "stroke-lp-primary opacity-100" : "stroke-lp-primary/40 opacity-60")} strokeWidth="0.5" strokeDasharray="1.2 4.8" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      <div className="absolute top-1/2 left-1/2 grid w-[27%] -translate-x-1/2 -translate-y-1/2 place-items-center gap-1.5 rounded-3xl border border-lp-border bg-white py-4 shadow-[0_24px_48px_-24px_rgba(23,43,66,0.35)] sm:gap-2 sm:py-6">
        <svg viewBox="0 0 32 32" aria-hidden className="size-9 sm:size-12">
          <rect width="32" height="32" rx="8" className="fill-lp-primary" />
          <rect x="8" y="9" width="16" height="3.5" rx="1.75" className="fill-white" />
          <rect x="8" y="14.25" width="12" height="3.5" rx="1.75" className="fill-white" />
          <rect x="8" y="19.5" width="8" height="3.5" rx="1.75" className="fill-white" />
        </svg>
        <span className="text-[11px] font-semibold tracking-tight text-lp-heading sm:text-sm">StoreForge</span>
      </div>

      <ul>
        {nodes.map((n, i) => {
          const [x, y] = POSITIONS[i];
          const Icon = INTEGRATION_ICONS[n.icon];
          const on = hot === n.id;
          return (
            <li
              key={n.id}
              // Focusable so keyboard users get the same highlight that pointer users get on hover.
              tabIndex={0}
              onMouseEnter={() => setHot(n.id)}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(n.id)}
              onBlur={() => setHot(null)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
            >
              <div
                className={cn(
                  "flex w-[4.75rem] transform-gpu flex-col items-center gap-1.5 rounded-2xl border bg-white px-2 py-3 transition-[translate,border-color] duration-700 will-change-transform sm:w-28 sm:gap-2 sm:py-4 motion-reduce:transition-none",
                  "ease-[cubic-bezier(0.22,1,0.36,1)]",
                  on ? "-translate-y-0.5 border-lp-primary/50" : "border-lp-border",
                )}
              >
                <span className={cn("grid size-9 place-items-center rounded-xl transition-colors duration-500 motion-reduce:transition-none sm:size-10", on ? "bg-lp-primary text-white" : "bg-lp-soft text-lp-primary")}>
                  <Icon className="size-[18px] sm:size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-center text-[11px] leading-tight font-medium text-lp-heading sm:text-xs">{n.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
