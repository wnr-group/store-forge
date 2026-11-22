"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

type Props = {
  /** URL of the product's primary picture. */
  imageUrl: string | null;
  value: Point | undefined;
  onChange: (point: Point) => void;
  disabled?: boolean;
  label?: string;
};

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Shows the whole picture and lets the owner mark its most important spot (click, drag, or arrow keys: 1% a step, Shift
 * for 10%). The storefront keeps that spot in view when it crops the picture. The marker sits on the picture's own
 * coordinates, so it is exact whatever shape the picture has. Unset means centred, the way it renders today.
 */
export function FocalPointPicker({ imageUrl, value, onChange, disabled, label = "Image focal point" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const point = value ?? { x: 50, y: 50 };

  const fromEvent = (e: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    onChange({ x: Math.round(clamp(((e.clientX - rect.left) / rect.width) * 100)), y: Math.round(clamp(((e.clientY - rect.top) / rect.height) * 100)) });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const delta: Record<string, Point | undefined> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const d = delta[e.key];
    if (!d || disabled) return;
    e.preventDefault();
    onChange({ x: clamp(point.x + d.x), y: clamp(point.y + d.y) });
  };

  if (!imageUrl) {
    return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">This product has no picture yet, so there is nothing to focus. Add one under Catalog &gt; Products.</p>;
  }

  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (disabled) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromEvent(e);
      }}
      onPointerMove={(e) => dragging.current && fromEvent(e)}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      className={cn("relative mx-auto w-full max-w-60 touch-none overflow-hidden rounded-md border bg-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring", disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair")}
    >
      {/* A plain img: the box must take the picture's own shape so the marker's percentages match the picture exactly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" draggable={false} className="block h-auto w-full" />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)]", value ? "bg-blue-600/70" : "bg-white/40")}
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
      />
    </div>
  );
}
