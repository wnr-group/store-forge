import { z } from "zod";

/**
 * Environment validation. Fails fast with the NAMES of missing/invalid
 * variables (never their values).
 *
 * NEXT_PUBLIC_* values must be referenced as literal `process.env.NEXT_PUBLIC_X`
 * so Next.js can inline them into the browser bundle.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    throw new Error(
      `Missing or invalid environment variables: ${names.join(", ")}. Copy .env.example to .env.local and fill them in.`,
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

// ---------------------------------------------------------------------------
// Server-only database configuration. Never import this from client code and
// never prefix these variables with NEXT_PUBLIC_.
// ---------------------------------------------------------------------------

/** The only login role the application may use. Created in the custom RLS migration. */
export const APP_DB_ROLE = "storeforge_app";

const postgresUrl = z
  .string()
  .min(1)
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// or postgresql:// URL");

const serverSchema = z.object({
  DATABASE_URL: postgresUrl.refine((v) => {
    // Defence in depth: ordinary queries must never run as the privileged
    // owner role (it BYPASSES row level security). Supavisor prefixes the
    // project ref: "<role>.<ref>".
    try {
      const user = decodeURIComponent(new URL(v).username);
      return user !== "postgres" && !user.startsWith("postgres.");
    } catch {
      return false;
    }
  }, `must connect as the ${APP_DB_ROLE} role, not the postgres owner role (which bypasses RLS)`),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Supabase service-role key. Used ONLY by lib/supabase/admin.ts to call the Admin Auth API
 * (create / confirm users, set passwords, delete users) from protected server code. It is never
 * used for database queries and must never be prefixed NEXT_PUBLIC_.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.length < 20) {
    throw new Error("Missing or invalid environment variable: SUPABASE_SERVICE_ROLE_KEY (server-only). See .env.example.");
  }
  return key;
}

/**
 * Secret that keys the sign-in rate-limit hashes, so an address or e-mail cannot be recomputed from what is stored. Server-only.
 * Uses RATE_LIMIT_SECRET when set, else the service-role key (which never leaves the server), else a fixed development value.
 * Set RATE_LIMIT_SECRET (any long random string) in production.
 */
export function getRateLimitSecret(): string {
  return process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "storeforge-development-rate-limit-secret";
}

let cachedServer: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse({ DATABASE_URL: process.env.DATABASE_URL });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
    throw new Error(`Invalid database environment: ${details.join("; ")}. See .env.example.`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}
