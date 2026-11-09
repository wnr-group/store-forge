import { defineConfig } from "vitest/config";
import { TIMING_TEST_FILES } from "./tests/timing-files";
import { sharedAlias, sharedTimeouts } from "./vitest.shared";

// Wall-clock budget tests run alone, one file at a time, never next to other files.
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    environment: "node",
    include: [...TIMING_TEST_FILES],
    fileParallelism: false,
    maxWorkers: 1,
    ...sharedTimeouts,
  },
});
