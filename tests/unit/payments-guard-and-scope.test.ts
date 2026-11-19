import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OWNER_NAV_ITEMS, NAV_ITEMS } from "@/components/dashboard/nav-config";
import { PROTECTED_PREFIXES, ROUTES } from "@/config/app";
import { capture } from "../support/payments-evidence";

const ROOT = join(__dirname, "..", "..");
const here = "tests/unit/payments-guard-and-scope.test.ts";
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ---- the page guard ---------------------------------------------------------------------------------------------------

const requireWorkspace = vi.fn();
const redirect = vi.fn((to: string): never => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
const getPaymentConfig = vi.fn();
vi.mock("@/lib/tenant/context", () => ({ requireWorkspace: () => requireWorkspace() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/services/payment.service", () => ({ getPaymentConfig: () => getPaymentConfig(), savePaymentConfig: vi.fn(), removePaymentConfig: vi.fn() }));
vi.mock("@/components/payments/payment-config-form", () => ({ PaymentConfigForm: () => null }));
vi.mock("@/components/shared/page-header", () => ({ PageHeader: () => null }));

const workspace = (role: "owner" | "admin" | "staff") => ({ user: { id: "u" }, active: { role, permissions: {}, tenant: { id: "t", name: "Shop" } }, store: null });

describe("the Payments page guard [layer:FE]", () => {
  beforeEach(() => {
    requireWorkspace.mockReset();
    redirect.mockClear();
    getPaymentConfig.mockReset();
  });

  it("AC-FE-03: a non-owner is redirected to the dashboard before any payments data is read", async () => {
    const { default: Page } = await import("@/app/(dashboard)/dashboard/payments/page");
    for (const role of ["admin", "staff"] as const) {
      requireWorkspace.mockResolvedValue(workspace(role));
      await expect(Page()).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.dashboard}`);
    }
    expect(getPaymentConfig).not.toHaveBeenCalled();
  });

  it("AC-FE-03: the Owner reaches the page and the status is read", async () => {
    const { default: Page } = await import("@/app/(dashboard)/dashboard/payments/page");
    requireWorkspace.mockResolvedValue(workspace("owner"));
    getPaymentConfig.mockResolvedValue({ configured: false });
    await expect(Page()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
    expect(getPaymentConfig).toHaveBeenCalledTimes(1);
  });
});

// ---- server actions: field errors and unmapped errors -------------------------------------------------------------------

const service = { save: vi.fn() };
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("error mapping through the save action [layer:FE]", () => {
  it("AC-FE-08: API field errors come back keyed by field, for the form to show inline", async () => {
    vi.resetModules();
    vi.doMock("@/services/payment.service", () => ({ savePaymentConfig: (...a: unknown[]) => service.save(...a), removePaymentConfig: vi.fn() }));
    const { savePaymentConfigAction } = await import("@/app/(dashboard)/dashboard/payments/actions");
    const { AppError } = await import("@/lib/errors"); // the same module copy the action uses
    service.save.mockRejectedValue(new AppError("VALIDATION", "Please check the details you entered.", { keyId: "Enter a valid Razorpay Key ID." }));
    const result = await savePaymentConfigAction({ keyId: "rzp_test_abcdefgh", keySecret: "a".repeat(16) });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { keyId: "Enter a valid Razorpay Key ID." } });
  });

  it("AC-UI-25: a rate-limit answer keeps the application's message and an unmapped failure shows only the generic one", async () => {
    vi.resetModules();
    vi.doMock("@/services/payment.service", () => ({ savePaymentConfig: (...a: unknown[]) => service.save(...a), removePaymentConfig: vi.fn() }));
    const { savePaymentConfigAction } = await import("@/app/(dashboard)/dashboard/payments/actions");
    const { AppError } = await import("@/lib/errors"); // the same module copy the action uses
    const pair = { keyId: "rzp_test_abcdefgh", keySecret: "SYNTH0a1b2c3d4e5f6a7b8" };
    service.save.mockRejectedValueOnce(new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again."));
    expect(await savePaymentConfigAction(pair)).toMatchObject({ ok: false, code: "RATE_LIMITED", error: "Too many requests. Please wait a moment and try again." });
    service.save.mockRejectedValueOnce(new Error(`relation "tenant_razorpay_config" does not exist, near ${pair.keySecret}`));
    const unmapped = await savePaymentConfigAction(pair);
    expect(unmapped).toMatchObject({ ok: false, code: "UNKNOWN", error: "Something went wrong. Please try again." });
    expect(JSON.stringify(unmapped)).not.toMatch(/relation|tenant_razorpay_config|SYNTH/);
  });
});

// ---- regression and scope ---------------------------------------------------------------------------------------------

describe("regression and scope [layer:FE]", () => {
  it("AC-REG-03: the Owner navigation is unchanged apart from the new Payments entry", () => {
    const withoutPayments = OWNER_NAV_ITEMS.filter((n) => n.href !== ROUTES.payments).map((n) => n.href);
    expect(withoutPayments).toEqual([...NAV_ITEMS.slice(0, -1).map((n) => n.href), ROUTES.team, ROUTES.settings]);
    expect(OWNER_NAV_ITEMS).toHaveLength(NAV_ITEMS.length + 2);
  });

  it("AC-REG-10: Settings stays the last Workspace entry and keeps its route", () => {
    expect(ROUTES.settings).toBe("/dashboard/settings");
    expect(OWNER_NAV_ITEMS[OWNER_NAV_ITEMS.length - 1]).toMatchObject({ href: ROUTES.settings, label: "Settings", group: "Workspace" });
  });

  it("AC-REG-02: the anonymous and customer storefront routes are still outside the protected area", () => {
    expect([...PROTECTED_PREFIXES]).toEqual([ROUTES.dashboard, ROUTES.admin, ROUTES.noWorkspace]);
    expect(ROUTES.payments.startsWith(ROUTES.dashboard)).toBe(true);
    for (const prefix of PROTECTED_PREFIXES) expect("/s/urban-nest-demo".startsWith(prefix)).toBe(false);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe("static scans [layer:STATIC]", () => {
  const changed = () => [...new Set([...git("diff", "--name-only", "origin/main").split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")])].filter(Boolean);
  const ours = () => changed().filter((f) => !f.startsWith("artifacts/") && !f.startsWith("tests/unit/payments-guard-and-scope.test.ts"));

  it("AC-REG-15 [layer:STATIC]: no Firebase dependency or integration was introduced (frontend)", async () => {
    const word = new RegExp(["fire", "base"].join(""), "i");
    const files = ours();
    const hits = files.filter((f) => word.test(f) || (!/package-lock/.test(f) && word.test(git("diff", "origin/main", "--unified=0", "--", f))));
    const manifests = ["package.json", "package-lock.json"].filter((f) => word.test(git("diff", "origin/main", "--unified=0", "--", f)));
    await capture({
      acId: "AC-REG-15", folder: "logs", fileName: "AC-REG-15.txt", layer: "STATIC", environment: "unit", testName: "AC-REG-15", testFile: here,
      actualResult: `scanned ${files.length} changed files and the manifests for the word: ${hits.length + manifests.length} found`,
      assert: () => {
        expect(hits).toEqual([]);
        expect(manifests).toEqual([]);
      },
      content: () => `AC-REG-15: files scanned: ${files.length}; manifests scanned: package.json, package-lock.json; matches: ${hits.length + manifests.length}\n`,
    });
  });

  it("AC-SCOPE-01 [layer:STATIC]: no shopper login, registration or authentication enforcement was introduced (frontend)", async () => {
    const files = ours();
    const authTouched = files.filter((f) => /^(app\/\(auth\)|lib\/auth|lib\/supabase|proxy\.ts|app\/s\/|components\/storefront)/.test(f) && f !== "lib/auth/permissions.ts");
    const readers = walk("lib").concat(walk("app"), walk("components"), walk("services")).filter((f) => /customerAuthEnabled|customer_auth_enabled/.test(read(f)));
    await capture({
      acId: "AC-SCOPE-01", folder: "logs", fileName: "AC-SCOPE-01.txt", layer: "STATIC", environment: "unit", testName: "AC-SCOPE-01", testFile: here,
      actualResult: `no authentication, session, proxy or storefront file changed; the flag is not referenced by any frontend file`,
      assert: () => {
        expect(authTouched).toEqual([]);
        expect(readers).toEqual([]);
      },
      content: () => `AC-SCOPE-01: changed files: ${files.length}; auth/session/proxy/storefront files changed: ${authTouched.length}; frontend references to the flag: ${readers.length}\n`,
    });
  });

  it("AC-SCOPE-02 [layer:STATIC]: no Razorpay SDK, outbound Razorpay call, webhook, checkout or payment-processing code (frontend)", async () => {
    const pkg = JSON.parse(read("package.json")) as Record<string, Record<string, string> | undefined>;
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => /razorpay/i.test(d));
    const source = ours().filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith("tests/"));
    const hosts = source.filter((f) => /razorpay\.com|checkout\.js/i.test(read(f)));
    const handlers = changed().filter((f) => /(^|\/)route\.(ts|tsx)$/.test(f));
    await capture({
      acId: "AC-SCOPE-02", folder: "logs", fileName: "AC-SCOPE-02.txt", layer: "STATIC", environment: "unit", testName: "AC-SCOPE-02", testFile: here,
      actualResult: "no razorpay dependency, razorpay host or checkout script in changed source, and no route handler was added",
      assert: () => {
        expect(deps).toEqual([]);
        expect(hosts).toEqual([]);
        expect(handlers).toEqual([]);
      },
      content: () => `AC-SCOPE-02: razorpay dependencies: ${deps.length}; razorpay hosts in changed source: ${hosts.length}; route handlers added: ${handlers.length}\n`,
    });
  });
});
