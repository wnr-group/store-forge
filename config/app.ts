export const APP_NAME = "StoreForge";

/** Cookie holding the *preferred* tenant id. It is a hint only - never proof of access. */
export const ACTIVE_TENANT_COOKIE = "sf_active_tenant";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  authCallback: "/auth/callback",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
} as const;

/** Routes that require a signed-in user (enforced again server-side in the data layer). */
export const PROTECTED_PREFIXES = [ROUTES.dashboard, ROUTES.onboarding] as const;

/** Pages a signed-in user has no reason to see. */
export const GUEST_ONLY_ROUTES = [ROUTES.login, ROUTES.register, ROUTES.forgotPassword] as const;

/** Slugs that must never be claimed (they would collide with app routes / subdomains). Mirrors the DB function. */
export const RESERVED_SLUGS = [
  "www", "app", "api", "admin", "dashboard", "auth", "login", "register",
  "static", "assets", "cdn", "mail", "support", "help", "billing",
  "storeforge", "status", "blog", "docs",
] as const;
