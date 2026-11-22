"use client";

import { useEffect, useState } from "react";

/**
 * The preview clock: the real time (refreshed each minute so badges and state chips stay current) or, once the merchant picks one,
 * a "Preview as of" instant (UTC ISO). Editor state only: nothing here is saved or sent anywhere, and the public storefront never reads it.
 */
export function usePreviewClock() {
  const [previewNow, setPreviewNow] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const picked = previewNow === null ? NaN : Date.parse(previewNow);
  return { previewNow, setPreviewNow, nowMs: Number.isFinite(picked) ? picked : tick };
}
