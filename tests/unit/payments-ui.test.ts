import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/app";
import { OWNER_NAV_ITEMS, NAV_ITEMS, hiddenNavHrefs } from "@/components/dashboard/nav-config";
import { canManagePayments, can, type Actor } from "@/lib/auth/permissions";
import { KEY_ID_MESSAGE, KEY_SECRET_MESSAGE, KEY_ID_PATTERN, KEY_SECRET_PATTERN, paymentConfigSchema } from "@/lib/validations/payments";
import { capture } from "../support/payments-evidence";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
const here = "tests/unit/payments-ui.test.ts";

const owner: Actor = { role: "owner", permissions: {} };
const admin: Actor = { role: "admin", permissions: { products: "write", orders: "read", customers: "write", settings: "write" } };
const staff: Actor = { role: "staff", permissions: { settings: "write" } };

describe("permission, route and navigation [layer:FE]", () => {
  it("AC-PERM-07: payments:manage is owner-only and mirrors the API", () => {
    expect(canManagePayments(owner)).toBe(true);
    expect(canManagePayments(admin)).toBe(false);
    expect(canManagePayments(staff)).toBe(false);
    expect(canManagePayments({ role: "admin", permissions: { products: "write", orders: "read", customers: "write", settings: "write" } })).toBe(false);
    expect(can(owner, "payments:manage")).toBe(true);
  });

  it("AC-FE-01: ROUTES.payments is /dashboard/payments", () => {
    expect(ROUTES.payments).toBe("/dashboard/payments");
  });

  it("AC-FE-02: the Payments nav item is in the Owner navigation only, in Workspace, before Settings", () => {
    const i = OWNER_NAV_ITEMS.findIndex((n) => n.href === ROUTES.payments);
    expect(i).toBeGreaterThan(-1);
    expect(OWNER_NAV_ITEMS[i]).toMatchObject({ label: "Payments", group: "Workspace" });
    expect(OWNER_NAV_ITEMS[i + 1].href).toBe(ROUTES.settings);
    expect(NAV_ITEMS.map((n) => n.href)).not.toContain(ROUTES.payments);
    expect(OWNER_NAV_ITEMS.filter((n) => n.href === ROUTES.payments)).toHaveLength(1);
    // Non-owners are shown the merchant navigation, which has no entry for it, and no permission rule hides anything new.
    expect(hiddenNavHrefs(owner)).not.toContain(ROUTES.payments);
  });
});

describe("Zod mirrors the API rules exactly [layer:FE]", () => {
  const KEY_IDS: [string, boolean][] = [
    ["rzp_test_abcdefgh", true], ["rzp_live_ABCDEFGH12", true], ["rzp_test_12345678", true], [`rzp_live_${"a1".repeat(40)}`, true],
    ["rzp_test_abcdefg", false], ["rzp_demo_abcdefgh", false], ["RZP_test_abcdefgh", false], ["rzp_test_abcd efgh", false],
    ["rzp_test_abcdefgh\n", false], [" rzp_test_abcdefgh", false], ["rzp_test_abcdefg_", false], ["rzp_test_abcdéfgh", false], ["rzp_live_", false], ["", false],
  ];
  const secret = (n: number) => "a".repeat(n);
  const SECRETS: [string, boolean][] = [
    [secret(16), true], [secret(128), true], ["Z9".repeat(64), true], ["aB3dE6gH9jK2mN5pQ8sT1vXy", true],
    [secret(15), false], [secret(129), false], ["", false], [` ${secret(16)}`, false], [`${secret(16)} `, false], [`${secret(8)} ${secret(8)}`, false],
    [`${secret(16)}\n`, false], [`${secret(15)}_`, false], [`${secret(15)}é`, false],
  ];

  it("AC-FE-06: the Key ID pattern is the approved one and gives the same verdicts as the API corpus", () => {
    expect(KEY_ID_PATTERN.source).toBe("^rzp_(test|live)_[A-Za-z0-9]{8,}$");
    for (const [value, ok] of KEY_IDS) {
      const result = paymentConfigSchema.safeParse({ keyId: value, keySecret: secret(16) });
      expect(result.success, JSON.stringify(value)).toBe(ok);
      if (!ok) expect(result.error?.issues[0].message).toBe(KEY_ID_MESSAGE);
    }
  });

  it("AC-FE-07: the secret rule is the approved one (16 to 128 letters and numbers, never trimmed)", () => {
    expect(KEY_SECRET_PATTERN.source).toBe("^[A-Za-z0-9]{16,128}$");
    for (const [value, ok] of SECRETS) {
      const result = paymentConfigSchema.safeParse({ keyId: "rzp_test_abcdefgh", keySecret: value });
      expect(result.success, JSON.stringify(value)).toBe(ok);
      if (!ok) expect(result.error?.issues[0].message).toBe(KEY_SECRET_MESSAGE);
    }
  });

  it("rejects missing, non-string and unknown fields, and never echoes the value in a message", () => {
    expect(paymentConfigSchema.safeParse({ keyId: "rzp_test_abcdefgh" }).success).toBe(false);
    expect(paymentConfigSchema.safeParse({ keySecret: secret(16) }).success).toBe(false);
    expect(paymentConfigSchema.safeParse({ keyId: "rzp_test_abcdefgh", keySecret: 1234567890123456 }).success).toBe(false);
    expect(paymentConfigSchema.safeParse({ keyId: "rzp_test_abcdefgh", keySecret: secret(16), tenantId: "x" }).success).toBe(false);
    const bad = `${secret(15)}!SYNTHLEAK`;
    const messages = paymentConfigSchema.safeParse({ keyId: "rzp_test_short", keySecret: bad }).error!.issues.map((i) => i.message).join(" ");
    expect(messages).not.toContain("SYNTHLEAK");
    expect(messages).not.toContain("rzp_test_short");
  });
});

// ---- server actions -------------------------------------------------------------------------------------------------

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
const service = { save: vi.fn(), remove: vi.fn() };
vi.mock("@/services/payment.service", () => ({
  savePaymentConfig: (...a: unknown[]) => service.save(...a),
  removePaymentConfig: (...a: unknown[]) => service.remove(...a),
}));

const SECRET = "SYNTHa1b2c3d4e5f6a7b8";
const PAIR = { keyId: "rzp_test_AbCdEfGh12345678", keySecret: SECRET };

describe("server actions [layer:FE]", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    service.save.mockReset();
    service.remove.mockReset();
  });

  it("AC-FE-11: the payments page is revalidated after each successful save, replace and remove, and not after a failure", async () => {
    const { removePaymentConfigAction, savePaymentConfigAction } = await import("@/app/(dashboard)/dashboard/payments/actions");
    service.save.mockResolvedValue({ configured: true, keyIdMasked: "rzp_test_••••5678", mode: "test", updatedAt: new Date(), updatedByName: "A" });
    service.remove.mockResolvedValue(undefined);
    await savePaymentConfigAction(PAIR);
    await savePaymentConfigAction({ ...PAIR, keyId: "rzp_live_ZyXwVuTs12345678" });
    await removePaymentConfigAction();
    expect(revalidatePath.mock.calls).toEqual([[ROUTES.payments], [ROUTES.payments], [ROUTES.payments]]);
    revalidatePath.mockClear();
    service.save.mockRejectedValue(new Error("boom"));
    expect((await savePaymentConfigAction(PAIR)).ok).toBe(false);
    expect((await savePaymentConfigAction({ keyId: "bad", keySecret: SECRET })).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AC-FE-10: no action result ever contains the submitted secret, on success or failure", async () => {
    const { removePaymentConfigAction, savePaymentConfigAction } = await import("@/app/(dashboard)/dashboard/payments/actions");
    service.save.mockResolvedValueOnce({ configured: true, keyIdMasked: "rzp_test_••••5678", mode: "test", updatedAt: new Date(), updatedByName: null });
    service.save.mockRejectedValueOnce(new Error(`failed with ${SECRET}`));
    service.remove.mockResolvedValue(undefined);
    const results = [
      await savePaymentConfigAction(PAIR),
      await savePaymentConfigAction(PAIR),
      await savePaymentConfigAction({ keyId: "rzp_test_short", keySecret: SECRET }),
      await removePaymentConfigAction(),
    ];
    for (const r of results) expect(JSON.stringify(r)).not.toContain(SECRET);
    expect(results[1]).toMatchObject({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("AC-FE-12 [layer:STATIC]: both actions use the run() wrapper with an operation name", async () => {
    const source = read("app/(dashboard)/dashboard/payments/actions.ts");
    const runs = source.match(/run\(/g) ?? [];
    const operations = [...source.matchAll(/operation: "([a-z.]+)"/g)].map((m) => m[1]);
    await capture({
      acId: "AC-FE-12", folder: "logs", fileName: "AC-FE-12.txt", layer: "STATIC", environment: "unit", testName: "AC-FE-12", testFile: here,
      actualResult: `both server actions call run() with operations ${operations.join(", ")}`,
      assert: () => {
        expect(runs).toHaveLength(2);
        expect(operations).toEqual(["payments.save", "payments.remove"]);
        expect(source).toContain('import { run } from "@/lib/actions/run"');
      },
      content: () => `AC-FE-12: run() calls: ${runs.length}; operations: ${operations.join(", ")}\n`,
    });
  });
});

// ---- static ---------------------------------------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const PAYMENT_FILES = [
  "lib/api/endpoints/payment-api.ts", "lib/validations/payments.ts", "services/payment.service.ts",
  "components/payments/payment-config-form.tsx", ...walk("app/(dashboard)/dashboard/payments"),
];

describe("static checks [layer:STATIC]", () => {
  it("AC-FE-15 [layer:STATIC]: the payments code has no direct database access", () => {
    for (const f of PAYMENT_FILES) {
      const source = read(f);
      expect(source, f).not.toMatch(/from "(@\/lib\/db|drizzle-orm|postgres|pg|@supabase)/);
      expect(source, f).not.toMatch(/withTenantDb|withAuthenticatedDb|\.execute\(/);
    }
  });

  it("AC-FE-14 [layer:STATIC]: Settings is unmodified and no frontend REST route handler was added", async () => {
    const files = git("diff", "--name-only", "origin/main").split("\n").filter(Boolean);
    const untracked = git("ls-files", "--others", "--exclude-standard", "--", "app", "components", "lib", "services", "config").split("\n").filter(Boolean);
    const changed = [...new Set([...files, ...untracked])];
    const settings = changed.filter((f) => /^(app\/\(dashboard\)\/dashboard\/settings|components\/settings)\//.test(f));
    const handlers = changed.filter((f) => /(^|\/)route\.(ts|tsx|js)$/.test(f));
    await capture({
      acId: "AC-FE-14", folder: "logs", fileName: "AC-FE-14.txt", layer: "STATIC", environment: "unit", testName: "AC-FE-14", testFile: here,
      actualResult: `${changed.length} changed or new source files; none under Settings, none named route.ts`,
      assert: () => {
        expect(settings).toEqual([]);
        expect(handlers).toEqual([]);
      },
      content: () => `AC-FE-14: files changed against origin/main: ${changed.length}\nSettings files changed: ${settings.length}\nroute handlers added: ${handlers.length}\n`,
    });
  });

  it("AC-FE-16 [layer:STATIC]: the Payments screen reuses the existing design system and adds no UI dependency or global style", async () => {
    const changed = [...new Set([...git("diff", "--name-only", "origin/main").split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")])].filter(Boolean);
    const imports = PAYMENT_FILES.filter((f) => f.endsWith(".tsx")).flatMap((f) => [...read(f).matchAll(/from "([^"]+)"/g)].map((m) => m[1]));
    const external = [...new Set(imports.filter((i) => !i.startsWith("@/") && !i.startsWith(".")))].sort();
    const unexpected = changed.filter((f) => /^(package(-lock)?\.json|app\/globals\.css|components\/ui\/|components\/settings\/|app\/\(dashboard\)\/dashboard\/(?!payments\/)[^/]+\/)/.test(f));
    await capture({
      acId: "AC-FE-16", folder: "logs", fileName: "AC-FE-16.txt", layer: "STATIC", environment: "unit", testName: "AC-FE-16", testFile: here,
      actualResult: `payments components import only existing shared and ui components (external packages: ${external.join(", ")}); no dependency, global style or other page changed`,
      assert: () => {
        expect(external).toEqual(["lucide-react", "next", "next/navigation", "react", "sonner"]);
        expect(unexpected).toEqual([]);
        expect(imports.filter((i) => i.startsWith("@/components/")).every((i) => /^@\/components\/(ui|shared|payments)\//.test(i))).toBe(true);
      },
      content: () => `AC-FE-16 (a): external imports: ${external.join(", ")}\nunexpected changed files: ${unexpected.length}\nchanged files: ${changed.length}\n`,
    });
  });
});
