"use client";

import { createContext, useContext } from "react";
import type { RenderContext } from "./types";

export const StorefrontContext = createContext<RenderContext | null>(null);

export function useStorefrontContext(): RenderContext {
  const ctx = useContext(StorefrontContext);
  if (!ctx) {
    throw new Error("useStorefrontContext must be used within a StorefrontContext.Provider");
  }
  return ctx;
}
