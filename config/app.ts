export const APP_NAME = "StoreForge";

/** Cookie holding the *preferred* tenant id. It is a hint only - never proof of access. */
export const ACTIVE_TENANT_COOKIE = "sf_active_tenant";

/** UI preference cookie: "1" when the desktop sidebar is collapsed. */
export const SIDEBAR_COOKIE = "sf_sidebar";

export const ROUTES = {
  home: "/",
  login: "/login",
  noWorkspace: "/no-workspace",
  admin: "/admin",
  adminCompanies: "/admin/organizations",
  adminNewCompany: "/admin/organizations/new",
  adminAccount: "/admin/account",
  adminActivity: "/admin/activity",
  adminTeam: "/admin/team",
  adminUsage: "/admin/usage",
  adminSettings: "/admin/settings",
  dashboard: "/dashboard",
  products: "/dashboard/products",
  categories: "/dashboard/categories",
  collections: "/dashboard/collections",
  inventory: "/dashboard/inventory",
  customers: "/dashboard/customers",
  analytics: "/dashboard/analytics",
  team: "/dashboard/team",
  orders: "/dashboard/orders",
  payments: "/dashboard/payments",
  transactions: "/dashboard/payments/transactions",
  refunds: "/dashboard/payments/refunds",
  shipping: "/dashboard/shipping",
  carriers: "/dashboard/shipping/carriers",
  zones: "/dashboard/shipping/zones",
  shippingMethods: "/dashboard/shipping/methods",
  shipments: "/dashboard/shipping/shipments",
  taxes: "/dashboard/taxes",
  settings: "/dashboard/settings",
  templates: "/dashboard/templates",
  themeEditor: "/dashboard/templates/editor",
  pages: "/dashboard/pages",
  navigation: "/dashboard/navigation",
} as const;

/** Routes that require a signed-in user (enforced again server-side in the data layer). */
export const PROTECTED_PREFIXES = [ROUTES.dashboard, ROUTES.admin, ROUTES.noWorkspace] as const;

/** Pages a signed-in user has no reason to see. There is no public registration: sign-in is the only guest page. */
export const GUEST_ONLY_ROUTES = [ROUTES.login] as const;

/** Slugs that must never be claimed (they would collide with app routes / subdomains). Mirrors the DB function. */
export const RESERVED_SLUGS = [
  "www", "app", "api", "admin", "dashboard", "auth", "login", "register",
  "static", "assets", "cdn", "mail", "support", "help", "billing",
  "storeforge", "status", "blog", "docs",
] as const;
