import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

import { updateSession } from "@/lib/supabase/middleware";

const req = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const signedIn = () => getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
const signedOut = () => getClaims.mockResolvedValue({ data: null, error: null });
const location = (res: Response) => res.headers.get("location");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(30));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  getClaims.mockReset();
});

describe("proxy route protection (unauthenticated)", () => {
  it.each(["/dashboard", "/dashboard/anything", "/onboarding"])("redirects %s to /login with next=", async (path) => {
    signedOut();
    const res = await updateSession(req(path));
    expect(res.status).toBe(307);
    expect(location(res)).toContain("/login?next=");
    expect(decodeURIComponent(location(res)!)).toContain(path);
  });

  it("sends reset-password without a session to forgot-password", async () => {
    signedOut();
    const res = await updateSession(req("/reset-password"));
    expect(location(res)).toContain("/forgot-password?error=expired");
  });

  it.each(["/", "/login", "/register", "/forgot-password", "/verify-email"])("allows public page %s", async (path) => {
    signedOut();
    const res = await updateSession(req(path));
    expect(res.status).toBe(200);
    expect(location(res)).toBeNull();
  });
});

describe("proxy route protection (authenticated)", () => {
  it.each(["/login", "/register", "/forgot-password"])("redirects %s to /dashboard", async (path) => {
    signedIn();
    const res = await updateSession(req(path));
    expect(location(res)).toContain("/dashboard");
  });

  it.each(["/dashboard", "/onboarding", "/reset-password"])("lets signed-in users reach %s", async (path) => {
    signedIn();
    const res = await updateSession(req(path));
    expect(res.status).toBe(200);
  });
});
