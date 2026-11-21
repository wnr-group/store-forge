"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { StorefrontErrorState } from "@/components/storefront/error-state";

/**
 * Error boundary for every storefront route (/s/[slug]/**). The thrown error is never shown: server errors may carry internals.
 * `reset()` alone only re-renders with the server payload that already failed; `router.refresh()` asks the server for a new one,
 * so Retry is a real recovery attempt on the same URL.
 */
export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return <StorefrontErrorState onRetry={retry} retrying={retrying} />;
}
