import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Not present (e.g. CI injecting real env vars) - fine.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  // Only manage the public schema. auth.* belongs to Supabase and is merely
  // referenced by foreign keys.
  schemaFilter: ["public"],
  dbCredentials: {
    // MIGRATIONS ONLY. Connects as the privileged owner role (postgres) via a
    // direct or session-mode connection. The app itself uses DATABASE_URL
    // (storeforge_app), which cannot run DDL and cannot bypass RLS.
    url: process.env.DIRECT_URL ?? "",
  },
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
  strict: true,
  verbose: true,
});
