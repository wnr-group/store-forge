import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // The real package throws outside the Next.js server runtime.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // Each DB test file boots its own in-process Postgres (WASM). Cap parallel
    // workers so a typical dev machine is not starved of memory.
    maxWorkers: 3,
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
