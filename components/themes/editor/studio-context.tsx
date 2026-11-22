"use client";

import { createContext, useContext } from "react";
import { NO_FEATURES, type StudioFeatures } from "@/lib/templates/studio-features";

/** What this store and member may do with gated Studio components (from GET store/studio/status and the member's permissions). */
export type StudioCaps = { features: StudioFeatures; canAttest: boolean };

const Ctx = createContext<StudioCaps>({ features: NO_FEATURES, canAttest: false });

export const StudioCapsProvider = Ctx.Provider;
export const useStudioCaps = (): StudioCaps => useContext(Ctx);
