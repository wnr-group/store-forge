"use client";

import { Toaster } from "sonner";
import { useResolvedTheme } from "@/lib/theme/store";

/** Sonner follows the app theme (our `dark` class), not just the OS setting. */
export function ThemedToaster() {
  return <Toaster richColors position="top-right" theme={useResolvedTheme()} />;
}
