import path from "node:path";

// Shared by vitest.config.mts and vitest.timing.config.mts (and probes that alias it).
export const sharedAlias = {
  "@": path.resolve(import.meta.dirname, "."),
  // The real package throws outside the Next.js server runtime.
  "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
};

export const sharedTimeouts = {
  testTimeout: 30_000,
  hookTimeout: 60_000,
  teardownTimeout: 60_000,
};
