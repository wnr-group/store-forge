import { configDefaults, defineConfig } from "vitest/config";
import { TIMING_TEST_FILES } from "./tests/timing-files";
import { sharedAlias, sharedTimeouts } from "./vitest.shared";

export default defineConfig({
  resolve: {
    alias: sharedAlias,
  },
  test: {
    environment: "node",
    // Cap parallel workers so a typical dev machine is not starved of memory.
    maxWorkers: 3,
    include: ["tests/**/*.test.ts"],
    // Wall-clock budget files run serially via vitest.timing.config.mts.
    exclude: [...configDefaults.exclude, ...TIMING_TEST_FILES],
    ...sharedTimeouts,
  },
});
