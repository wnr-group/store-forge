import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectiveInterval } from "@/components/landing/pricing-utils";
import { GUEST_ONLY_ROUTES, PROTECTED_PREFIXES, ROUTES } from "@/config/app";
import { defaultHomePath } from "@/lib/auth/home";
import { onboardingPath, planChoiceFrom, planQuery } from "@/lib/onboarding/path";
import { registerSchema } from "@/lib/validations/auth";
import { checkoutSchema, storeNameSchema } from "@/lib/validations/onboarding";

const read = (file: string) => readFileSync(file, "utf8");

describe("account form", () => {
  const valid = { fullName: "  Asha Rao ", email: " Asha@Example.COM ", password: "Asha-pass-1", confirmPassword: "Asha-pass-1", acceptTerms: true };

  it("trims the name and lower-cases the e-mail", () => {
    expect(registerSchema.parse(valid)).toMatchObject({ fullName: "Asha Rao", email: "asha@example.com" });
  });

  it("asks for every field and for the Terms", () => {
    const messages = (input: object) => registerSchema.safeParse(input).error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`) ?? [];
    expect(messages({ ...valid, fullName: "A" })).toEqual(["fullName: Enter your full name"]);
    expect(messages({ ...valid, confirmPassword: "Other-pass-1" })).toEqual(["confirmPassword: Passwords do not match"]);
    expect(messages({ ...valid, acceptTerms: false })).toEqual(["acceptTerms: Accept the Terms and Conditions to continue"]);
    expect(messages({ ...valid, password: "alllowercase", confirmPassword: "alllowercase" })).toEqual(["password: Include at least one number"]);
    expect(messages({ ...valid, email: "nope" })).toEqual(["email: Enter a valid email address"]);
  });
});

describe("the plan travels through sign-up", () => {
  it("is read from the address, with monthly as the fallback period", () => {
    expect(planChoiceFrom("growth", "yearly")).toEqual({ planCode: "growth", billingInterval: "yearly" });
    expect(planChoiceFrom("growth", "monthly")).toEqual({ planCode: "growth", billingInterval: "monthly" });
    expect(planChoiceFrom("growth", "bogus")).toEqual({ planCode: "growth", billingInterval: "monthly" });
    expect(planChoiceFrom("growth", undefined)).toEqual({ planCode: "growth", billingInterval: "monthly" });
  });

  it("is dropped when it is not shaped like a plan code, so nothing odd ends up in a redirect", () => {
    for (const bad of [undefined, "", "x", "UPPER", "a/b", "https://evil.com", "../admin", "a b", "x".repeat(41)]) expect(planChoiceFrom(bad, "monthly"), String(bad)).toBeNull();
  });

  it("builds a same-site onboarding path, with or without a plan", () => {
    expect(planQuery(null)).toBe("");
    expect(onboardingPath(null)).toBe("/onboarding");
    expect(onboardingPath({ planCode: "growth", billingInterval: "yearly" })).toBe("/onboarding?plan=growth&interval=yearly");
  });

  it("buys a plan with no yearly price monthly, as its card shows it", () => {
    expect(effectiveInterval({ yearlyPriceMinor: 0 }, "yearly")).toBe("monthly");
    expect(effectiveInterval({ yearlyPriceMinor: 999000 }, "yearly")).toBe("yearly");
    expect(effectiveInterval({ yearlyPriceMinor: 999000 }, "monthly")).toBe("monthly");
  });
});

describe("what the browser may send", () => {
  it("names a plan and a billing period, never a price", () => {
    expect(checkoutSchema.parse({ planCode: "growth", billingInterval: "yearly", amountMinor: 1 })).toEqual({ planCode: "growth", billingInterval: "yearly" });
    expect(checkoutSchema.safeParse({ planCode: "growth", billingInterval: "weekly" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ planCode: "Growth!", billingInterval: "monthly" }).success).toBe(false);
  });

  it("asks for a store name only, with sensible bounds", () => {
    expect(storeNameSchema.parse({ storeName: "  Blue Door Coffee ", storeSlug: "chosen-by-browser" })).toEqual({ storeName: "Blue Door Coffee" });
    expect(storeNameSchema.safeParse({ storeName: "A" }).success).toBe(false);
    expect(storeNameSchema.safeParse({ storeName: "   " }).success).toBe(false);
    expect(storeNameSchema.safeParse({ storeName: "x".repeat(81) }).success).toBe(false);
  });
});

describe("routing", () => {
  it("keeps the onboarding behind sign-in and the sign-up page for visitors only", () => {
    expect([...PROTECTED_PREFIXES]).toContain(ROUTES.onboarding);
    expect([...GUEST_ONLY_ROUTES]).toContain(ROUTES.signup);
    expect(ROUTES.signup).toBe("/signup");
    expect(ROUTES.onboarding).toBe("/onboarding");
  });

  it("sends staff to the admin area, owners to their dashboard and a customer with no store to the onboarding", () => {
    expect(defaultHomePath({ platformAdminLevel: "admin", membershipCount: 0 })).toBe(ROUTES.admin);
    expect(defaultHomePath({ platformAdminLevel: null, membershipCount: 2 })).toBe(ROUTES.dashboard);
    expect(defaultHomePath({ platformAdminLevel: null, membershipCount: 0 })).toBe(ROUTES.onboarding);
    expect(defaultHomePath(null)).toBe(ROUTES.dashboard);
  });
});

describe("the public header", () => {
  const chrome = read("components/landing/site-chrome.tsx");
  const actions = read("components/landing/auth-actions.tsx");
  const menu = read("components/landing/mobile-menu.tsx");

  it("offers Home, Features and Pricing, then Login and Get Started", () => {
    expect(chrome).toMatch(/label: "Home"/);
    expect(chrome).toMatch(/label: "Features"/);
    expect(chrome).toMatch(/label: "Pricing"/);
    expect(actions).toContain("Login");
    expect(actions).toContain("Get Started");
    expect(actions).toContain("ROUTES.signup");
    expect(actions).toContain("ROUTES.login");
  });

  it("never links to the Platform Admin area from the public header", () => {
    const header = chrome.slice(0, chrome.indexOf("const FOOTER_COLUMNS"));
    // Comments may explain the rule; only code can link anywhere.
    const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const source of [header, actions, menu].map(code)) {
      expect(source).not.toMatch(/ROUTES\.admin/);
      expect(source).not.toMatch(/["'`]\/admin/);
      expect(source).not.toMatch(/Platform Admin|Admin Dashboard/i);
    }
  });

  it("starts the sign-up from a pricing card with the plan and billing period chosen", () => {
    const cards = read("components/landing/pricing-plans.tsx");
    expect(cards).toContain("/signup?plan=");
    expect(cards).toContain("effectiveInterval(plan, interval)");
  });
});
