import { describe, expect, it } from "vitest";
import { shotPath } from "../e2e/support/shot-path";

describe("shotPath", () => {
  it("routes AC-prefixed names into the criterion's folder", () => {
    expect(shotPath("AC-NAV-1_owner-sidebar", "T")).toEqual({ dir: "artifacts/qa/screenshots/AC-NAV-1", file: "owner-sidebar.png" });
  });
  it("keeps legacy names under the ticket folder", () => {
    expect(shotPath("login", "TEMPLATES-V1")).toEqual({ dir: "artifacts/qa/screenshots/TEMPLATES-V1", file: "login.png" });
  });
  it("never lets a name escape its folder", () => {
    expect(shotPath("AC-NAV-1_../../x", "T").file).not.toContain("..");
    expect(shotPath("../evil", "T").dir).toBe("artifacts/qa/screenshots/T");
  });
});
