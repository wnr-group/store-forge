import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(dashboard)/dashboard/payments/actions", () => ({ savePaymentConfigAction: vi.fn(), removePaymentConfigAction: vi.fn() }));

describe("the Payments form [layer:FE]", () => {
  const render = async (config: Parameters<typeof import("@/components/payments/payment-config-form").PaymentConfigForm>[0]["config"]) => {
    const { PaymentConfigForm } = await import("@/components/payments/payment-config-form");
    return renderToStaticMarkup(createElement(PaymentConfigForm, { config }));
  };
  const configured = { configured: true as const, keyIdMasked: "rzp_test_••••5678", mode: "test" as const, updatedAtLabel: "19 Nov 2026, 6:15 pm UTC", updatedByName: "Alice Owner" };

  it("AC-FE-13: shows the masked Key ID and a Test or Live badge from the API's mode", async () => {
    const test = await render(configured);
    const live = await render({ ...configured, mode: "live", keyIdMasked: "rzp_live_••••9abc" });
    expect(test).toContain("rzp_test_••••5678");
    expect(test).toMatch(/>Test</);
    expect(test).not.toMatch(/>Live</);
    expect(live).toContain("rzp_live_••••9abc");
    expect(live).toMatch(/>Live</);
  });

  it("unconfigured: shows Not configured and a Save button, and no Remove control or replace hint", async () => {
    const html = await render({ configured: false });
    expect(html).toContain("Not configured");
    expect(html).toContain("Save credentials");
    expect(html).not.toContain("Remove credentials");
    expect(html).not.toContain("Secret saved, enter a new value to replace it");
    expect(html).not.toContain("Configured (saved)");
  });

  it("configured: shows the saved state, the exact copy, who and when, Replace and Remove", async () => {
    const html = await render(configured);
    expect(html).toContain("Configured (saved)");
    expect(html).toContain("saved, not verified");
    expect(html).toContain("Secret saved, enter a new value to replace it");
    expect(html).toContain("Last updated 19 Nov 2026, 6:15 pm UTC by Alice Owner");
    expect(html).toContain("Replace credentials");
    expect(html).toContain("Remove credentials");
    expect(await render({ ...configured, updatedByName: null })).toContain("by a former team member");
  });

  it("the Key Secret input is a password field that is never prefilled", async () => {
    for (const config of [{ configured: false as const }, configured]) {
      const html = await render(config);
      const input = /<input[^>]*id="pay-key-secret"[^>]*>/.exec(html)?.[0] ?? "";
      expect(input).toMatch(/type="password"/);
      expect(input).toMatch(/value=""/);
      expect(input).not.toMatch(/value="[^"]/);
    }
  });

  it("AC-UI-26 [layer:FE]: no Test Connection, Verify or Connect control and no Verified or Connected text in any state", async () => {
    for (const config of [{ configured: false as const }, configured]) {
      const html = await render(config);
      const visible = html.replace(/<[^>]+>/g, " ");
      expect(visible).not.toMatch(/\bVerified\b|\bConnected\b|Test Connection|\bVerify\b|\bConnect\b/);
      expect(html).not.toMatch(/<button[^>]*>[^<]*(Verify|Connect|Test connection)/i);
    }
  });

  it("AC-FE-16 [layer:FE]: the screen is built from the existing design system (shared settings section, form fields, ui buttons and badges)", async () => {
    const html = await render(configured);
    expect(html).toContain('data-slot="button"'); // components/ui/button
    expect(html).toContain('data-slot="badge"'); // components/ui/badge
    expect(html).toMatch(/<section class="grid gap-4 py-6 lg:grid-cols-\[15rem_minmax\(0,1fr\)\]/); // components/shared/settings-section
    expect(html).toMatch(/id="pay-key-id-msg"/); // components/shared/form-field: accessible message slot
    expect(html).toMatch(/aria-describedby="pay-key-secret-msg"/);
  });
});

