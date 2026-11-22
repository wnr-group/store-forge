import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const api = vi.fn();
vi.mock("@/lib/api/endpoints/studio-api", () => ({ getStudioStatusApi: (...a: unknown[]) => api(...a) }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: vi.fn(async () => ({ tenant: { id: "t1" } })) }));

import { getStudioStatus } from "@/services/studio.service";

const NONE = { badge_upload: "unavailable", review_import: "unavailable" };

describe("studio status service", () => {

  it("reports enabled only for an answer that is exactly enabled: true", async () => {
    api.mockResolvedValue({ enabled: true, extra: 1 });
    expect(await getStudioStatus()).toEqual({ enabled: true, features: NONE });
    api.mockResolvedValue({ enabled: "true" });
    expect(await getStudioStatus()).toEqual({ enabled: false, features: NONE });
    api.mockResolvedValue(undefined);
    expect(await getStudioStatus()).toEqual({ enabled: false, features: NONE });
  });

  it("reads any failure, such as a missing route, as disabled", async () => {
    api.mockImplementation(async () => { throw new Error("404 Not Found"); });
    expect(await getStudioStatus()).toEqual({ enabled: false, features: NONE });
  });

  it("exposes the features map and reads an absent or unknown value as unavailable", async () => {
    api.mockResolvedValue({ enabled: true, features: { badge_upload: "available", review_import: "pending" } });
    expect((await getStudioStatus()).features).toEqual({ badge_upload: "available", review_import: "unavailable" });
    api.mockResolvedValue({ enabled: true, features: { review_import: "available" } });
    expect((await getStudioStatus()).features).toEqual({ badge_upload: "unavailable", review_import: "available" });
    api.mockResolvedValue({ enabled: true });
    expect((await getStudioStatus()).features).toEqual(NONE);
  });
});
