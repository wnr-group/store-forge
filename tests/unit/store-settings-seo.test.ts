import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The SEO section of the store Settings page. The repo has no DOM test environment, so the form is rendered to static markup (the
 * convention of add-to-bag-wishlist.test.ts) and the save path is tested at the server action the form submits to.
 */

const updateStoreSettings = vi.fn<(values: unknown) => Promise<void>>(async () => undefined);
const invalidateStorefront = vi.fn(async () => undefined);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, updateTag: () => {} }));
vi.mock("@/services/store-settings.service", () => ({ updateStoreSettings: (v: unknown) => updateStoreSettings(v), isCurrencyLocked: async () => false }));
vi.mock("@/services/profile.service", () => ({ updateOwnName: async () => undefined, getOwnProfile: async () => ({}) }));
vi.mock("@/lib/storefront/cache", () => ({ invalidateStorefront: () => invalidateStorefront() }));
vi.mock("@/app/(dashboard)/dashboard/uploads/actions", () => ({ requestUploadsAction: async () => ({ ok: true, data: [] }) }));

import { StoreSettingsForm } from "@/components/settings/store-settings-form";
import type { Store } from "@/lib/domain/entities";

const store: Store = {
  id: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  name: "Acme Candles",
  slug: "acme",
  description: "Hand-poured soy candles.",
  logoUrl: null,
  metaTitle: null,
  metaDescription: null,
  contactEmail: null,
  contactPhone: null,
  currency: "INR",
  timezone: "Asia/Kolkata",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

const render = (over: Partial<Store> = {}, canEdit = true) =>
  renderToStaticMarkup(createElement(StoreSettingsForm, { store: { ...store, ...over }, publicId: "zqkod2", canEdit, currencyLocked: false }));

describe("SEO fields on the store Settings page", () => {
  it("shows a Meta title input and a Meta description textarea", () => {
    const html = render();
    expect(html).toContain("Meta title");
    expect(html).toContain("Meta description");
    expect(html).toMatch(/<input[^>]*id="st-meta-title"/);
    expect(html).toMatch(/<textarea[^>]*id="st-meta-desc"/);
  });

  it("starts empty with 0/70 and 0/160 counters when the store has no SEO text", () => {
    const html = render();
    expect(html).toContain("0/70");
    expect(html).toContain("0/160");
    expect(html).toContain("Up to 70 characters");
    expect(html).toContain("Up to 160 characters");
  });

  it("loads the existing values and counts them", () => {
    const metaTitle = "Acme | Handmade candles";
    const metaDescription = "Small-batch soy candles, poured by hand.";
    const html = render({ metaTitle, metaDescription });
    expect(html).toContain(`value="${metaTitle}"`);
    expect(html).toMatch(/<textarea[^>]*>Small-batch soy candles, poured by hand\.<\/textarea>/);
    expect(html).toContain(`>${metaTitle.length}/70<`);
    expect(html).toContain(`>${metaDescription.length}/160<`);
  });

  it("keeps the other settings as they were", () => {
    const html = render({ metaTitle: "T" });
    expect(html).toContain('value="Acme Candles"');
    expect(html).toContain('value="acme"');
    expect(html).toContain("Hand-poured soy candles.");
  });

  it("turns the counter red only past the limit", () => {
    expect(render({ metaTitle: "t".repeat(70) })).toMatch(/text-muted-foreground[^>]*>70\/70/);
    expect(render({ metaTitle: "t".repeat(71) })).toMatch(/text-error[^>]*>71\/70/);
  });

  it("is read-only for a member who cannot manage the store", () => {
    const html = render({ metaTitle: "T" }, false);
    expect(html).toMatch(/<input[^>]*id="st-meta-title"[^>]*disabled/);
    expect(html).toMatch(/<textarea[^>]*id="st-meta-desc"[^>]*disabled/);
  });
});

describe("saving the SEO fields", () => {
  const form = { name: "Acme Candles", slug: "acme", description: "Hand-poured soy candles.", contactEmail: "", contactPhone: "", currency: "INR", timezone: "Asia/Kolkata", logoPath: null };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends both fields to the settings service, and refreshes the cached storefront", async () => {
    const { saveStoreSettingsAction } = await import("@/app/(dashboard)/dashboard/settings/actions");
    const res = await saveStoreSettingsAction({ ...form, metaTitle: "Acme | Handmade candles", metaDescription: "Poured by hand." });
    expect(res.ok).toBe(true);
    expect(updateStoreSettings).toHaveBeenCalledWith(expect.objectContaining({ name: "Acme Candles", slug: "acme", metaTitle: "Acme | Handmade candles", metaDescription: "Poured by hand." }));
    expect(invalidateStorefront).toHaveBeenCalledTimes(1);
  });

  it("sends null when the merchant clears the fields (that is what removes them on the API)", async () => {
    const { saveStoreSettingsAction } = await import("@/app/(dashboard)/dashboard/settings/actions");
    await saveStoreSettingsAction({ ...form, metaTitle: "", metaDescription: "   " });
    expect(updateStoreSettings).toHaveBeenLastCalledWith(expect.objectContaining({ metaTitle: null, metaDescription: null }));
  });

  it("still sends the other settings with them", async () => {
    const { saveStoreSettingsAction } = await import("@/app/(dashboard)/dashboard/settings/actions");
    await saveStoreSettingsAction({ ...form, metaTitle: "T", metaDescription: "D" });
    expect(updateStoreSettings).toHaveBeenLastCalledWith(expect.objectContaining({ currency: "INR", timezone: "Asia/Kolkata", description: "Hand-poured soy candles.", logoPath: null, contactEmail: null }));
  });

  it("refuses an over-long title or description without calling the service", async () => {
    const { saveStoreSettingsAction } = await import("@/app/(dashboard)/dashboard/settings/actions");
    const longTitle = await saveStoreSettingsAction({ ...form, metaTitle: "t".repeat(71), metaDescription: "" });
    expect(longTitle.ok).toBe(false);
    const longDescription = await saveStoreSettingsAction({ ...form, metaTitle: "", metaDescription: "d".repeat(161) });
    expect(longDescription.ok).toBe(false);
    expect(updateStoreSettings).not.toHaveBeenCalled();
    expect(invalidateStorefront).not.toHaveBeenCalled();
  });

  it("accepts exactly 70 and 160 characters", async () => {
    const { saveStoreSettingsAction } = await import("@/app/(dashboard)/dashboard/settings/actions");
    const res = await saveStoreSettingsAction({ ...form, metaTitle: "t".repeat(70), metaDescription: "d".repeat(160) });
    expect(res.ok).toBe(true);
    expect(updateStoreSettings).toHaveBeenCalledTimes(1);
  });
});
