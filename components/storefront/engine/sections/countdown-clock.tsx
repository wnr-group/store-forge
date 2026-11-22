"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n/messages";
import { clockOffset, milestoneMessageKey, milestoneOf, pad2, remainingMs, serverTimeAt, splitRemaining } from "@/lib/templates/countdown";
import { CountdownEndMessage, unitLabel } from "./countdown-parts";

/**
 * The live part of a countdown. The first render (server and browser alike) uses only the props, so there is no hydration
 * mismatch: remaining = target - serverNow. After hydration the browser clock is read ONCE to get its offset from the server
 * clock, and a timer then shows target - (browser clock + offset). Nothing here animates; the digits are aria-hidden, and a single
 * visually hidden polite message is spoken only when a milestone is crossed (never every second).
 */
export function CountdownClock({ target, serverNow, heading, endBehavior, endMessage }: { target: number; serverNow: number; heading: string; endBehavior: "hide" | "message"; endMessage: string }) {
  const [remaining, setRemaining] = useState(() => remainingMs(target, serverNow));

  useEffect(() => {
    const offset = clockOffset(serverNow, Date.now());
    const tick = () => setRemaining(remainingMs(target, serverTimeAt(Date.now(), offset)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target, serverNow]);

  if (remaining <= 0) {
    return endBehavior === "message" && endMessage ? <CountdownEndMessage message={endMessage} /> : null;
  }

  const p = splitRemaining(remaining);
  const units: [number, number][] = [[p.days, 0], [p.hours, 1], [p.minutes, 2], [p.seconds, 3]];
  const announcement = t(milestoneMessageKey(milestoneOf(remaining)));

  return (
    <div className="text-center">
      {heading ? <h2 className="mb-4 text-2xl tracking-tight text-foreground sm:text-3xl">{heading}</h2> : null}
      <time dateTime={new Date(target).toISOString()} aria-hidden="true" className="inline-flex items-start justify-center gap-3 sm:gap-5" data-countdown-digits="">
        {units.map(([value, i]) => (
          <span key={i} className="flex min-w-14 flex-col items-center">
            <span className="text-3xl font-semibold tabular-nums text-foreground sm:text-5xl">{pad2(value)}</span>
            <span className="mt-1 text-xs text-muted-foreground uppercase">{unitLabel(i)}</span>
          </span>
        ))}
      </time>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  );
}
