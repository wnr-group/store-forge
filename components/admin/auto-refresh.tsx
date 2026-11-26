"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Re-renders the server page every `seconds` (polling: there is no push channel on purpose), only while the tab is visible, and offers a
 * manual refresh. The page itself fetches fresh data on every render.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setBusy(true);
        router.refresh();
        setTimeout(() => setBusy(false), 600);
      }}
      aria-label={`Refresh now. This page also refreshes every ${seconds} seconds.`}
    >
      <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden /> Refresh
    </Button>
  );
}
