import { BarChart3, CreditCard, Landmark, Megaphone, Truck, type LucideIcon } from "lucide-react";

/** Category icons, looked up by key. Neutral glyphs on purpose: no third-party logos. Shared by server and client components. */
export const INTEGRATION_ICONS = { payments: CreditCard, shipping: Truck, marketing: Megaphone, analytics: BarChart3, accounting: Landmark } satisfies Record<string, LucideIcon>;
export type IntegrationIcon = keyof typeof INTEGRATION_ICONS;
