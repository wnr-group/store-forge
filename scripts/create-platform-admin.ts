/**
 * npm run admin:create -- --email you@example.com [--name "Your Name"]
 * PLATFORM_ADMIN_PASSWORD='<strong password>' is read from the ENVIRONMENT (never from argv or a file in git).
 *
 * Bootstraps a StoreForge Platform Admin - the only account type that can create companies:
 *   1. creates (or finds) the confirmed Supabase Auth user through the Admin Auth API
 *      (needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL), and
 *   2. inserts it into public.platform_admins over the privileged DIRECT_URL.
 * There is no web flow, API or SQL policy that can do step 2, so nobody can self-promote.
 * Run it from a trusted machine; unset the variables afterwards.
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the real environment instead.
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Platform Admin";
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, DIRECT_URL: directUrl } = process.env;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Pass a valid --email.");
  if (!url || !serviceKey || !directUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DIRECT_URL must be set.");

  const auth = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;

  // Find an existing user first (idempotent promote), else create a confirmed one.
  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    if (!password || password.length < 12) throw new Error("Set PLATFORM_ADMIN_PASSWORD (at least 12 characters) in the environment.");
    const { data, error } = await auth.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    userId = data.user.id;
    console.log(`Created Auth user ${email}.`);
  } else {
    console.log(`Auth user ${email} already exists; promoting it.`);
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(directUrl).hostname);
  const sql = postgres(directUrl, { max: 1, prepare: false, ssl: isLocal ? false : "require", connect_timeout: 15, onnotice: () => {} });
  try {
    await sql`insert into public.platform_admins (user_id) values (${userId}) on conflict do nothing`;
    console.log(`${email} is a Platform Admin. Sign in at /login; you will land on /admin.`);
  } catch (e) {
    // A tenant member cannot also be a Platform Admin (database trigger).
    if (userId && String(e).includes("member_cannot_be_platform_admin")) throw new Error(`${email} is already a company member. Use a separate account for platform administration.`);
    throw e;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("admin:create failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
