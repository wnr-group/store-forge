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
