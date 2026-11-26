import type { AbandonedCartStatusApi, CampaignPhaseApi, CampaignStatusApi, DiscountStatusApi } from "@/lib/api/endpoints/marketing-api";
import { formatMoney } from "@/lib/money";

/** How the dashboard words what the API reports. Colour is never the only signal: every status has its own text. */
export type Tone = "active" | "draft" | "warning" | "danger" | "info" | "neutral";

export const DISCOUNT_STATUS: Record<DiscountStatusApi, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "active" },
  disabled: { label: "Off", tone: "draft" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "draft" },
  exhausted: { label: "Used up", tone: "warning" },
  campaign_inactive: { label: "Waiting for campaign", tone: "warning" },
};

export const CAMPAIGN_PHASE: Record<CampaignPhaseApi, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "draft" },
  scheduled: { label: "Scheduled", tone: "info" },
  live: { label: "Live", tone: "active" },
  paused: { label: "Paused", tone: "warning" },
  ended: { label: "Ended", tone: "draft" },
};

export const CART_STATUS: Record<AbandonedCartStatusApi, { label: string; tone: Tone }> = {
  active: { label: "Still shopping", tone: "info" },
  abandoned: { label: "Abandoned", tone: "warning" },
  recovered: { label: "Recovered", tone: "active" },
  expired: { label: "Expired", tone: "draft" },
};

/** "10% off", "12.5% off up to ₹250", "₹250 off". */
export function discountValueLabel(d: { kind: "percentage" | "fixed"; value: number; maxDiscountMinor: number | null }, currency: string): string {
  if (d.kind === "fixed") return `${formatMoney(d.value, currency)} off`;
  const pct = `${Number((d.value / 100).toFixed(2))}% off`;
  return d.maxDiscountMinor ? `${pct} up to ${formatMoney(d.maxDiscountMinor, currency)}` : pct;
}

/** "3 of 100", "3" without a limit. */
export const usageLabel = (used: number, limit: number | null) => (limit === null ? String(used) : `${used} of ${limit}`);

/** What the next step of a campaign is, as buttons: the status it can move to and what to call the move. */
export function campaignActions(status: CampaignStatusApi): { to: CampaignStatusApi; label: string; destructive?: boolean }[] {
  switch (status) {
    case "draft":
      return [{ to: "active", label: "Activate" }];
    case "active":
      return [{ to: "paused", label: "Pause" }, { to: "completed", label: "Complete", destructive: true }];
    case "paused":
      return [{ to: "active", label: "Resume" }, { to: "completed", label: "Complete", destructive: true }];
    case "completed":
      return [];
  }
}

/** The change since the previous period, e.g. "+12.5%", "-3%", or "no change" / "new" when there is nothing to compare to. */
export function changeLabel(pct: number | null | undefined): { text: string; tone: "up" | "down" | "flat" | "none" } {
  if (pct === null || pct === undefined) return { text: "No earlier period to compare", tone: "none" };
  if (pct === 0) return { text: "No change", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 ? "up" : "down" };
}
