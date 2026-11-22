import { describe, expect, it } from "vitest";
import {
  accessEntries,
  accessLevel,
  CAPABILITY_LABELS,
  can,
  canAccess,
  effectiveCapabilities,
  hasCapability,
  LEVEL_LABELS,
  MODULE_LABELS,
  presetOf,
  ROLE_PRESET_KEYS,
  ROLE_PRESETS,
  roleLabel,
  summarizePermissions,
  type Actor,
  type Permission,
} from "@/lib/auth/permissions";
import { ACCESS_LEVELS, MEMBER_CAPABILITIES, MODULES, type AccessLevel } from "@/lib/domain/enums";
import { createMemberSchema, permissionsToForm, updateMemberSchema } from "@/lib/validations/team";

const member = (design?: AccessLevel, capabilities?: Actor["capabilities"], extra: Actor["permissions"] = {}): Actor => ({
  role: "admin",
  permissions: { ...extra, ...(design ? { design } : {}) },
  capabilities,
});
const owner: Actor = { role: "owner", permissions: {} };

const LEVEL_PERMS: Permission[] = ["design:view", "design:edit", "design:publish"];

describe("design module definitions", () => {
  it("adds the design module, the publish level and the two capabilities", () => {
    expect(MODULES).toContain("design");
    expect(ACCESS_LEVELS).toEqual(["none", "read", "write", "publish"]);
    expect(MEMBER_CAPABILITIES).toEqual(["attest", "discard"]);
    expect(MODULE_LABELS.design.levels).toEqual(["none", "read", "write", "publish"]);
    expect(LEVEL_LABELS.publish).toBe("Read, write & publish");
    expect(Object.keys(CAPABILITY_LABELS)).toEqual(["attest", "discard"]);
  });
});

describe("can() permission matrix per design level", () => {
  const matrix: Record<AccessLevel, [boolean, boolean, boolean]> = {
    none: [false, false, false],
    read: [true, false, false],
    write: [true, true, false],
    publish: [true, true, true],
  };
  for (const [level, expected] of Object.entries(matrix) as [AccessLevel, boolean[]][]) {
    it(`design ${level}: view/edit/publish = ${expected.join("/")}`, () => {
      expect(LEVEL_PERMS.map((p) => can(member(level), p))).toEqual(expected);
    });
  }

  it("a member with no stored design level has no design access", () => {
    expect(LEVEL_PERMS.map((p) => can(member(), p))).toEqual([false, false, false]);
  });

  it("the Owner holds every design permission, including both capabilities, without any stored level", () => {
    for (const p of [...LEVEL_PERMS, "design:attest", "design:discard"] as const) expect(can(owner, p), p).toBe(true);
    expect(accessLevel(owner, "design")).toBe("publish");
    expect(accessLevel(owner, "products")).toBe("write");
  });

  it("a publish level outside design counts as write; canAccess compares ranks", () => {
    const odd: Actor = { role: "admin", permissions: { products: "publish" } };
    expect(accessLevel(odd, "products")).toBe("write");
    expect(canAccess(odd, "products", "write")).toBe(true);
    expect(canAccess(odd, "products", "publish")).toBe(false);
    expect(canAccess(member("write"), "design", "read")).toBe(true);
    expect(canAccess(member("read"), "design", "write")).toBe(false);
  });

  it("settings stay at least readable and the other modules are unaffected by the design level", () => {
    expect(accessLevel(member("publish"), "settings")).toBe("read");
    expect(can(member("publish"), "catalog:manage")).toBe(false);
    expect(can(member("none", [], { products: "write" }), "catalog:manage")).toBe(true);
  });
});

describe("attest and discard are independent capabilities", () => {
  it("design:publish without attest cannot attest, and attest without any level cannot view or edit", () => {
    const publisher = member("publish", []);
    expect(can(publisher, "design:publish")).toBe(true);
    expect(can(publisher, "design:attest")).toBe(false);
    expect(can(publisher, "design:discard")).toBe(false);
    const attester = member("none", ["attest"]);
    expect(can(attester, "design:attest")).toBe(true);
    expect(can(attester, "design:discard")).toBe(false);
    expect(LEVEL_PERMS.some((p) => can(attester, p))).toBe(false);
  });

  it("each capability is granted on its own", () => {
    expect(can(member("read", ["discard"]), "design:discard")).toBe(true);
    expect(can(member("read", ["discard"]), "design:attest")).toBe(false);
    expect(hasCapability(member("publish", ["attest"]), "attest")).toBe(true);
    expect(hasCapability(member("publish", undefined), "attest")).toBe(false);
  });

  it("effectiveCapabilities gives the Owner all, others only what was granted (in canonical order, ignoring junk)", () => {
    expect(effectiveCapabilities("owner", [])).toEqual(["attest", "discard"]);
    expect(effectiveCapabilities("admin", ["discard"])).toEqual(["discard"]);
    expect(effectiveCapabilities("admin", ["discard", "attest", "bogus" as never])).toEqual(["attest", "discard"]);
    expect(effectiveCapabilities("admin", null)).toEqual([]);
  });
});

describe("role presets and presetOf", () => {
  it("manager publishes and attests; staff and viewer only read the design", () => {
    expect(ROLE_PRESETS.manager.permissions.design).toBe("publish");
    expect(ROLE_PRESETS.manager.capabilities).toEqual(["attest"]);
    expect(ROLE_PRESETS.staff.permissions.design).toBe("read");
    expect(ROLE_PRESETS.viewer.permissions.design).toBe("read");
    expect(ROLE_PRESETS.staff.capabilities).toEqual([]);
    expect(ROLE_PRESETS.viewer.capabilities).toEqual([]);
  });

  it("every preset round-trips through presetOf and the schema", () => {
    for (const key of ROLE_PRESET_KEYS) {
      expect(presetOf(ROLE_PRESETS[key].permissions), key).toBe(key);
      expect(roleLabel("admin", ROLE_PRESETS[key].permissions)).toBe(ROLE_PRESETS[key].label);
    }
  });

  it("a changed design level makes the member Custom", () => {
    expect(presetOf({ ...ROLE_PRESETS.manager.permissions, design: "write" })).toBe("custom");
    expect(presetOf({ ...ROLE_PRESETS.staff.permissions, design: "none" })).toBe("custom");
  });

  it("fallback: a member with no stored design level is read as migration 0036 converts them", () => {
    const noDesign = (p: Record<string, string>) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "design"));
    const manager = noDesign(ROLE_PRESETS.manager.permissions);
    const staff = noDesign(ROLE_PRESETS.staff.permissions);
    const viewer = noDesign(ROLE_PRESETS.viewer.permissions);
    expect(presetOf(manager)).toBe("manager"); // settings write -> publish
    expect(presetOf(staff)).toBe("staff"); // settings read -> read
    expect(presetOf(viewer)).toBe("viewer");
    expect(presetOf({})).toBe("custom"); // nothing granted: settings read -> design read, but products none
    expect(presetOf({ settings: "write" })).toBe("custom");
  });

  it("summaries list the design level", () => {
    expect(accessEntries("admin", { design: "publish" }).find((e) => e.module === "design")?.level).toBe("publish");
    expect(accessEntries("admin", { design: "none" }).some((e) => e.module === "design")).toBe(false);
    expect(summarizePermissions("admin", { design: "write" })).toContain("Store design: Read & write");
    expect(summarizePermissions("owner", {})).toBe("Full access");
  });
});

describe("team form payload", () => {
  const base = { fullName: "Sana Staff", email: "sana@example.com", password: "initial-pass-1" };
  const id = "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40";

  it("carries the design level and the capabilities through to the payload", () => {
    const parsed = createMemberSchema.parse({ ...base, permissions: { ...ROLE_PRESETS.manager.permissions }, capabilities: ["attest", "discard"] });
    expect(parsed.permissions.design).toBe("publish");
    expect(parsed.capabilities).toEqual(["attest", "discard"]);
    const edited = updateMemberSchema.parse({ userId: id, fullName: "Sana Staff", permissions: { ...ROLE_PRESETS.staff.permissions, design: "write" }, capabilities: [] });
    expect(edited.permissions.design).toBe("write");
    expect(edited.capabilities).toEqual([]);
  });

  it("accepts all four design levels and rejects anything else or an unknown capability", () => {
    for (const design of ACCESS_LEVELS) expect(createMemberSchema.safeParse({ ...base, permissions: { ...ROLE_PRESETS.viewer.permissions, design } }).success, design).toBe(true);
    expect(createMemberSchema.safeParse({ ...base, permissions: { ...ROLE_PRESETS.viewer.permissions, design: "admin" } }).success).toBe(false);
    expect(createMemberSchema.safeParse({ ...base, permissions: ROLE_PRESETS.viewer.permissions, capabilities: ["publish"] }).success).toBe(false);
  });

  it("a publish level is still refused on the other modules", () => {
    expect(createMemberSchema.safeParse({ ...base, permissions: { ...ROLE_PRESETS.viewer.permissions, products: "publish" } }).success).toBe(false);
  });

  it("the form shows a member stored before design existed as the API converts them", () => {
    expect(permissionsToForm({ products: "write", settings: "write" }).design).toBe("publish");
    expect(permissionsToForm({ settings: "read" }).design).toBe("read");
    expect(permissionsToForm({ design: "none", settings: "write" }).design).toBe("none");
  });
});

describe("capabilities threaded into the Actor", () => {
  it("a membership from the workspace loader carries capabilities that can() reads", async () => {
    const { effectiveCapabilities: eff } = await import("@/lib/auth/permissions");
    const membership = { tenant: { id: "t", name: "T", slug: "t", publicId: "p" }, role: "admin" as const, permissions: { design: "write" as const }, capabilities: eff("admin", ["attest"]), joinedAt: new Date() };
    expect(can(membership, "design:attest")).toBe(true);
    expect(can(membership, "design:discard")).toBe(false);
    expect(can(membership, "design:edit")).toBe(true);
  });
});
