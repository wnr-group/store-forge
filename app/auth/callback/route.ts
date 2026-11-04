import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ROUTES } from "@/config/app";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils/redirect";

/**
 * Landing point for Supabase emails (verification + password recovery).
 * Supports the PKCE `code` flow and the `token_hash` flow. `next` is
 * restricted to same-origin paths to prevent open redirects.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: unknown = new Error("missing_params");

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  }

  if (error) {
    const failedRecovery = next.startsWith(ROUTES.resetPassword);
    return NextResponse.redirect(
      `${origin}${failedRecovery ? `${ROUTES.forgotPassword}?error=expired` : `${ROUTES.login}?error=callback`}`,
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
