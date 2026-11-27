import { describe, expect, it } from "vitest";
import { buildTimeline, trackingLabel } from "@/lib/customer/order-timeline";

const PLACED = "2026-11-01T10:00:00.000Z";
const at = (d: number) => `2026-11-0${d}T10:00:00.000Z`;

describe("order tracking timeline", () => {
  it("names the statuses the way the customer sees them", () => {
    expect(trackingLabel("pending_payment")).toBe("Order placed");
    expect(trackingLabel("ready_to_ship")).toBe("Packed");
    expect(trackingLabel("out_for_delivery")).toBe("Out for delivery");
    expect(trackingLabel("returned")).toBe("Returned");
    expect(trackingLabel("something_new")).toBe("Something new");
  });

  it("shows the whole path, with the current step marked and the later steps pending", () => {
    const steps = buildTimeline({ status: "processing", placedAt: PLACED, timeline: [{ status: "confirmed", at: at(1) }, { status: "processing", at: at(2) }] });
    expect(steps.map((s) => s.label)).toEqual(["Order placed", "Confirmed", "Processing", "Packed", "Shipped", "Out for delivery", "Delivered"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(steps[0].at).toBe(PLACED);
    expect(steps[2].at).toBe(at(2));
    expect(steps[3].at).toBeNull();
  });

  it("starts at 'Order placed' for an online order waiting for payment", () => {
    const steps = buildTimeline({ status: "pending_payment", placedAt: PLACED, timeline: [{ status: "pending_payment", at: PLACED }] });
    expect(steps[0].state).toBe("current");
    expect(steps.slice(1).every((s) => s.state === "upcoming")).toBe(true);
  });

  it("finishes a delivered order, skipping nothing and marking every step done", () => {
    const steps = buildTimeline({
      status: "delivered",
      placedAt: PLACED,
      timeline: ["confirmed", "processing", "ready_to_ship", "shipped", "delivered"].map((s, i) => ({ status: s, at: at(i + 1) })),
    });
    expect(steps.every((s) => s.state === "done")).toBe(true);
    expect(steps.at(-1)).toMatchObject({ label: "Delivered", at: at(5) });
  });

  it("keeps a step that was passed without an entry (shipped straight to delivered) as done, with no time", () => {
    const steps = buildTimeline({ status: "delivered", placedAt: PLACED, timeline: [{ status: "confirmed", at: at(1) }, { status: "shipped", at: at(2) }, { status: "delivered", at: at(3) }] });
    expect(steps).toHaveLength(7);
    expect(steps.every((s) => s.state === "done")).toBe(true);
    expect(steps.find((s) => s.key === "out_for_delivery")).toMatchObject({ state: "done", at: null });
  });

  it("ends a cancelled order where it stopped, with the time it was cancelled", () => {
    const steps = buildTimeline({ status: "cancelled", placedAt: PLACED, timeline: [{ status: "confirmed", at: at(1) }, { status: "cancelled", at: at(2) }] });
    expect(steps.map((s) => [s.label, s.state])).toEqual([["Order placed", "done"], ["Confirmed", "done"], ["Cancelled", "stopped"]]);
    expect(steps.at(-1)?.at).toBe(at(2));
  });

  it("shows a returned order's journey and then 'Returned'", () => {
    const steps = buildTimeline({
      status: "returned",
      placedAt: PLACED,
      timeline: ["confirmed", "processing", "ready_to_ship", "shipped", "returned"].map((s, i) => ({ status: s, at: at(i + 1) })),
    });
    expect(steps.map((s) => s.label)).toEqual(["Order placed", "Confirmed", "Processing", "Packed", "Shipped", "Returned"]);
    expect(steps.at(-1)?.state).toBe("stopped");
  });

  it("says 'Payment failed' for a failed online order", () => {
    const steps = buildTimeline({ status: "failed", placedAt: PLACED, timeline: [{ status: "pending_payment", at: PLACED }, { status: "failed", at: at(1) }] });
    expect(steps.map((s) => s.label)).toEqual(["Order placed", "Payment failed"]);
  });
});
