/**
 * Returns `candidate` only if it is a same-origin relative path; otherwise
 * `fallback`. Prevents open-redirect attacks via ?next= parameters
 * (e.g. "//evil.com", "/\\evil.com", "https://evil.com").
 */
export function safeNextPath(candidate: string | null | undefined, fallback = "/dashboard"): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(candidate)) return fallback;
  return candidate;
}
